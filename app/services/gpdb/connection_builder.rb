module Gpdb
  class ConnectionBuilder
    include ActiveModel::Validations

    validates_presence_of :name, :host, :port, :database
    validates_presence_of :username, :password
    validate :connection_must_be_established

    attr_reader :name, :host, :port, :database, :shared
    attr_reader :username, :password
    attr_reader :owner

    def self.create!(connection_config, owner)
      builder = new(connection_config, owner)
      builder.save!(owner)
      builder.instance
    end

    def self.update!(instance_id, connection_config, updater)
      instance = Instance.find(instance_id)
      raise SecurityTransgression unless updater.admin? || updater == instance.owner

      builder = for_update(connection_config, instance)
      builder.save!(updater)
      builder.instance
    end

    def self.for_update(connection_config, instance)
      new_owner = connection_config.delete(:owner) || instance.owner
      builder = new(connection_config, new_owner)
      builder.instance = instance
      builder.credentials = instance.owner_credentials
      builder
    end

    def initialize(attributes, owner)
      @name = attributes[:name]
      @host = attributes[:host]
      @port = attributes[:port]
      @database = attributes[:database]
      @username = attributes[:username]
      @password = attributes[:password]
      @owner = owner
      @shared = !!attributes[:shared]
    end

    def save!(user)
      valid!
      Instance.transaction do
        save_instance!
        InstanceCredential.destroy_all("instance_id = #{instance.id} AND id != #{credentials.id}") if instance.shared
        save_credentials!(user)
        raise(ActiveRecord::RecordInvalid.new(self)) if !instance.shared && instance.owner_credentials.nil?
      end
    end

    def valid!
      unless valid?
        raise ActiveRecord::RecordInvalid.new(self)
      end
    end

    def connection_must_be_established
      connection.verify_connection!
    rescue ConnectionError => e
      errors.add(:connection, e.message)
    end

    def instance
      @instance ||= owner.instances.build
    end

    attr_writer :instance

    def save_instance!
      instance.attributes = {
          :name => name,
          :host => host,
          :port => port,
          :maintenance_db => database,
          :shared => shared
      }
      instance.owner_id = owner.id
      instance.save!
    end

    def credentials
      @credentials ||= (
      credentials = instance.credentials.build
      credentials.owner = owner
      credentials
      )
    end

    attr_writer :credentials

    def save_credentials!(user)
      return unless user == credentials.owner

      credentials.attributes = {
          :username => username,
          :password => password,
      }
      credentials.owner_id = owner.id if shared
      credentials.save!
    end

    private

    def connection
      @connection ||= Gpdb::Connection.new(
          :name => name,
          :host => host,
          :port => port,
          :database => database,
          :username => username,
          :password => password
      )
    end
  end
end