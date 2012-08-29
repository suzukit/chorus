#!./chorus_installation/bin/ruby

require 'fileutils'
require 'securerandom'
require 'yaml'

class Install
  InstallationFailed = Class.new(StandardError)
  NonRootValidationError = Class.new(StandardError)
  CommandFailed = Class.new(StandardError)
  LocalhostUndefined = Class.new(StandardError)
  InvalidVersion = Class.new(StandardError)
  UpgradeCancelled = Class.new(StandardError)

  attr_accessor :destination_path, :database_password, :database_user, :do_upgrade

  DEFAULT_PATH = "/opt/chorus"

  MESSAGES = {
      select_os: "Could not detect your Linux version. Please select one of the following:",
      select_redhat_55: "[1] - RedHat (CentOS/RHEL) 5.5 or compatible",
      select_redhat_62: "[2] - RedHat (CentOS/RHEL) 6.2 or compatible",
      select_SLES_11: "[3] - SuSE Enterprise Linux Server 11 or compatible",
      select_abort_install: "[4] - Abort install",
      version_not_supported: "Version not supported",
      default_chorus_path: "Please enter Chorus destination path",
      installation_complete: "Installation completed.",
      installation_failed: "Installation failed. Please check install.log for details",
      installation_failed_with_reason: "Installation failed: %s",
      abort_install_non_root: "Aborting install: Please run the installer as a non-root user.",
      abort_install_localhost_undefined: "Aborting install: Could not connect to 'localhost', please set in /etc/hosts",
      run_server_control: "run ./server_control.sh start from %s to start everything up!",
      confirm_upgrade: "Existing version of Chorus detected. Upgrading will restart services.  Continue now? [y]:",
      cancelled_upgrade: "cancelled by user"
  }

  def initialize(installer_home)
    @installer_home = installer_home
  end

  def prompt(message)
    puts message
  end

  def validate_non_root
    raise NonRootValidationError if Process.uid == 0
  end

  def validate_localhost
    raise LocalhostUndefined unless system("ping -c 1 localhost > /dev/null")
  end

  def chorus_installation_path
    File.join(@installer_home, 'chorus_installation')
  end

  def determine_postgres_installer
    @postgres_package = get_postgres_build
  end

  def get_destination_path
    default_path = ENV['CHORUS_HOME'] || DEFAULT_PATH
    default_path = default_path.sub(/\/current$/, '')
    prompt "#{MESSAGES[:default_chorus_path]} [#{default_path}]:"
    @destination_path = File.expand_path(get_input || default_path)

    if Dir.exists?(@destination_path)
      installed_versions = Dir[File.join(@destination_path, 'releases', '*')]
      most_recent_installed_version = installed_versions.map { |path| File.basename(path) }.max do |a, b|
        a.split('.').map(&:to_i) <=> b.split('.').map(&:to_i)
      end

      if (most_recent_installed_version.split('.').map(&:to_i) <=> version.split('.').map(&:to_i)) >= 0 && !ENV['FORCE_DEPLOY']
        raise(InvalidVersion.new("Version #{version} is older than currently installed version (#{most_recent_installed_version})."))
      end

      prompt MESSAGES[:confirm_upgrade]
      user_upgrade_input = get_input || 'y'
      unless %w(y yes).include? user_upgrade_input.downcase
        raise(UpgradeCancelled)
      end

      self.do_upgrade = true
    end

  end

  def get_postgres_build
    input = nil
    input = 3 if is_supported_suse?

    redhat_version = supported_redhat_version
    input = 1 if redhat_version == '5.5'
    input = 2 if redhat_version == '6.2'

    while !(1..4).include?(input)
      prompt MESSAGES[:select_os]
      prompt MESSAGES[:select_redhat_55]
      prompt MESSAGES[:select_redhat_62]
      prompt MESSAGES[:select_SLES_11]
      prompt MESSAGES[:select_abort_install]
      input = get_input.to_i
    end

    case input
      when 1
        "postgres-redhat5.5-9.1.4.tar.gz"
      when 2
        "postgres-redhat6.2-9.1.4.tar.gz"
      when 3
        "postgres-suse11-9.1.4.tar.gz"
      else
        raise InstallationFailed, MESSAGES[:version_not_supported]
    end
  end

  def supported_redhat_version
    return nil unless File.exists?('/etc/redhat-release')

    version_string = File.open('/etc/redhat-release').read
    version_string =~ /release (\d\.\d)/
    found_version = $1
    found_version if %w(5.5 6.2).include?(found_version)
  end

  def is_supported_suse?
    return false unless File.exists?('/etc/SuSE-release')

    File.open('/etc/SuSE-release').readlines.any? do |release|
      release.match(/^VERSION = 11$/)
    end
  end

  def copy_chorus_to_destination
    FileUtils.mkdir_p(release_path)
    FileUtils.cp_r File.join(chorus_installation_path, '.'), release_path, :preserve => true
  end

  def create_shared_structure
    FileUtils.mkdir_p("#{destination_path}/shared/tmp/pids")
    FileUtils.mkdir_p("#{destination_path}/shared/solr/data")
    FileUtils.mkdir_p("#{destination_path}/shared/log")
    FileUtils.mkdir_p("#{destination_path}/shared/system")
  end

  def copy_config_files
    FileUtils.mkdir_p("#{destination_path}/shared")
    unless File.exists? "#{destination_path}/shared/database.yml"
      FileUtils.cp("#{chorus_installation_path}/packaging/database.yml.example", "#{destination_path}/shared/database.yml")
    end
    FileUtils.cp("#{chorus_installation_path}/config/chorus.yml.example", "#{destination_path}/shared/chorus.yml.example")
    unless File.exists? "#{destination_path}/shared/chorus.yml"
      FileUtils.cp("#{chorus_installation_path}/config/chorus.defaults.yml", "#{destination_path}/shared/chorus.yml")
    end
  end

  def link_services
    FileUtils.ln_sf("#{release_path}/packaging/server_control.sh", "#{destination_path}/server_control.sh")
  end

  def link_shared_files
    FileUtils.ln_sf("#{destination_path}/shared/chorus.yml", "#{release_path}/config/chorus.yml")
    FileUtils.ln_sf("#{destination_path}/shared/database.yml", "#{release_path}/config/database.yml")

    FileUtils.ln_sf("#{destination_path}/shared/db", "#{release_path}/postgres-db")
    FileUtils.ln_sf("#{destination_path}/shared/tmp", "#{release_path}/tmp")
    FileUtils.ln_sf("#{destination_path}/shared/solr", "#{release_path}/solr")
    FileUtils.ln_sf("#{destination_path}/shared/log", "#{release_path}/log")
    FileUtils.ln_sf("#{destination_path}/shared/system", "#{release_path}/system")
  end

  def create_database_config
    return if do_upgrade

    database_config_path = "#{destination_path}/shared/database.yml"
    database_config = YAML.load_file(database_config_path)

    self.database_password = SecureRandom.hex
    self.database_user = database_config['production']['username']

    database_config['production']['password'] = database_password

    File.open(database_config_path, 'w') do |file|
      YAML.dump(database_config, file)
    end
  end

  def setup_database
    if do_upgrade
      start_postgres
      chorus_exec "cd #{release_path} && RAILS_ENV=production bin/rake db:migrate"
      stop_postgres
    else
      chorus_exec "#{release_path}/postgres/bin/initdb --locale=en_US.UTF-8 #{destination_path}/shared/db"
      start_postgres
      chorus_exec %Q{#{release_path}/postgres/bin/psql -d postgres -p8543 -h 127.0.0.1 -c "CREATE ROLE #{database_user} PASSWORD '#{database_password}' SUPERUSER CREATEDB CREATEROLE INHERIT LOGIN"}
      chorus_exec "cd #{release_path} && RAILS_ENV=production bin/rake db:create db:migrate db:seed"
      stop_postgres
    end
  end

  def link_current_to_release
    File.delete("#{destination_path}/current") if File.exists?("#{destination_path}/current")
    FileUtils.ln_sf("#{release_path}", "#{destination_path}/current")
  end

  def extract_postgres
    chorus_exec("tar xzf #{release_path}/packaging/postgres/#{@postgres_package} -C #{release_path}/")
  end

  def stop_old_install
    return unless do_upgrade

    chorus_exec "CHORUS_HOME=#{destination_path}/current #{destination_path}/server_control.sh stop"
  end

  def startup
    return unless do_upgrade

    server_control "start"
  end

  private
  def get_input
    input = gets.strip
    input.empty? ? nil : input
  end

  def version
    File.read("#{chorus_installation_path}/version_build").strip
  end

  def release_path
    "#{destination_path}/releases/#{version}"
  end

  def chorus_exec(command)
    system("#{command} >> #{destination_path}/install.log 2>&1") || raise(CommandFailed, command)
  end

  def stop_postgres
    server_control "stop postgres"
  end

  def start_postgres
    server_control "start postgres"
  end

  def server_control(args)
    chorus_exec "CHORUS_HOME=#{release_path} #{release_path}/packaging/server_control.sh #{args}"
  end
end

if __FILE__ == $0
  begin
    install = Install.new(File.dirname(__FILE__))

    install.validate_non_root
    install.validate_localhost
    install.get_destination_path
    install.determine_postgres_installer

    print "Copying files into #{install.destination_path}..."
    install.copy_chorus_to_destination
    install.create_shared_structure
    install.copy_config_files
    install.create_database_config
    install.link_shared_files
    puts "Done"

    print "Extracting postgres..."
    install.extract_postgres
    puts "Done"

    if install.do_upgrade
      print "Shutting down previous Chorus install..."
      install.stop_old_install
      puts "Done"
      print "Updating database..."
    else
      print "Creating database..."
    end


    install.link_services
    install.setup_database
    puts "Done"

    install.link_current_to_release

    print "Starting up Chorus..."
    install.startup
    puts "Done"

    puts Install::MESSAGES[:installation_complete]
    puts Install::MESSAGES[:run_server_control] % install.destination_path unless install.do_upgrade
  rescue Install::NonRootValidationError
    puts Install::MESSAGES[:abort_install_non_root]
    exit 1
  rescue Install::UpgradeCancelled
    puts Install::MESSAGES[:installation_failed_with_reason] % Install::MESSAGES[:cancelled_upgrade]
    exit 1
  rescue Install::InvalidVersion => e
    puts Install::MESSAGES[:installation_failed_with_reason] % e.message
    exit 1
  rescue Install::CommandFailed => e
    File.open("install.log", "a") { |f| f.puts "#{e.class}: #{e.message}" }
    puts Install::MESSAGES[:installation_failed]
    exit 1
  rescue Install::LocalhostUndefined
    puts Install::MESSAGES[:abort_install_localhost_undefined]
    exit 1
  rescue => e
    File.open("install.log", "a") { |f| f.puts "#{e.class}: #{e.message}" }
    puts Install::MESSAGES[:installation_failed_with_reason] % e.message
    exit 1
  end
end