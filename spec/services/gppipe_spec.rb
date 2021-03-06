require 'spec_helper'

describe GpPipe, :database_integration => true do

  def setup_data
    gpdb1.exec_query("delete from #{source_table_name};")
    gpdb1.exec_query("insert into #{source_table_name}(id, name, id2, id3) values (1, 'marsbar', 3, 5);")
    gpdb1.exec_query("insert into #{source_table_name}(id, name, id2, id3) values (2, 'kitkat', 4, 6);")
    gpdb2.exec_query("drop table if exists #{gp_pipe.destination_table_fullname};")
  end

  before do
    stub.proxy(Chorus::Application.config.chorus).[](anything)
    stub(Chorus::Application.config.chorus).[](/^gpfdist\./) do |key|
      case key.sub(/^gpfdist\./, '')
        when "data_dir"
          '/tmp'
        when "write_port"
          "8000"
        when "read_port"
          "8001"
        when "url"
          Socket.gethostname
        when "ssl.enabled"
          false
      end
    end
  end

  # In the test, use gpfdist to move data between tables in the same schema and database
  let(:instance_account1) { InstanceIntegration.real_gpdb_account }
  let(:user) { instance_account1.owner }
  let(:database) { GpdbDatabase.find_by_name_and_gpdb_instance_id(InstanceIntegration.database_name, InstanceIntegration.real_gpdb_instance) }
  let(:schema_name) { 'test_gpfdist_schema' }
  let(:schema) { database.schemas.find_by_name(schema_name) }

  let(:gpdb1) do
    ActiveRecord::Base.postgresql_connection(
        :host => instance_account1.gpdb_instance.host,
        :port => instance_account1.gpdb_instance.port,
        :database => database.name,
        :username => instance_account1.db_username,
        :password => instance_account1.db_password,
        :adapter => "jdbcpostgresql")
  end

  let(:gpdb2) do
    ActiveRecord::Base.postgresql_connection(
        :host => instance_account1.gpdb_instance.host,
        :port => instance_account1.gpdb_instance.port,
        :database => database.name,
        :username => instance_account1.db_username,
        :password => instance_account1.db_password,
        :adapter => "jdbcpostgresql")
  end

  after :each do
    gpdb1.try(:disconnect!)
    gpdb2.try(:disconnect!)
    # We call src_schema from the test, although it is only called from run outside of tests, so we need to clean up
    gp_pipe.src_conn.try(:disconnect!)
    gp_pipe.dst_conn.try(:disconnect!)
  end

  let(:source_table) { "candy" }
  let(:source_table_name) { "\"#{schema_name}\".\"#{source_table}\"" }
  let(:destination_table_name) { "dst_candy" }
  let(:table_def) { '"id" numeric(4,0),
                     "name" character varying(255),
                      "id2" integer,
                      "id3" integer,
                      "date_test" date,
                      "fraction" double precision,
                      "numeric_with_scale" numeric(4,2),
                      "time_test" time without time zone,
                      "time_with_precision" time(3) without time zone,
                      "time_with_zone" time(3) with time zone,
                      "time_stamp_with_precision" timestamp(3) with time zone,
                      PRIMARY KEY("id2", "id3", "id")'.tr("\n","").gsub(/\s+/, " ").strip }
  let(:distrib_def) { "" }
  let(:import) { imports(:two) }
  let(:source_dataset) { schema.datasets.find_by_name(source_table) }
  let(:options) { {"workspace_id" => workspace.id, "to_table" => destination_table_name, "new_table" => "true", "import_id" => import.id }.merge(extra_options) }
  let(:extra_options) { {} }
  let(:gp_table_copier) { GpTableCopier.new(source_dataset.id, user.id, options) }
  let(:gp_pipe) { GpPipe.new(gp_table_copier) }
  let(:workspace) { FactoryGirl.create :workspace, :owner => user, :sandbox => schema }
  let(:sandbox) { workspace.sandbox }

  it 'uses gpfdist if the gpfdist.ssl.enabled configuration is false (no in the test environment)' do
    GpPipe.protocol.should == 'gpfdist'
  end

  context "#run" do

    after do
      gpdb1.exec_query("delete from #{gp_pipe.source_table_fullname};")
      gpdb2.exec_query("drop table if exists #{gp_pipe.destination_table_fullname};")
    end

    describe ".run_import" do

      context "into a new table" do
        before do
          extra_options.merge!("new_table" => true)
          setup_data
        end

        it "creates a new pipe and runs it" do
          gp_pipe.run
          gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 2
        end

        context "with a shorted timeout" do
          before do
            stub(GpPipe).grace_period_seconds { 1 }
          end

          it "drops the newly created table when the write hangs" do
            lambda { gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}") }.should raise_error
            stub(gp_pipe).write_pipe do
              while(true) do
                sleep(5)
              end
            end
            stub(gp_pipe).read_pipe(anything) { sleep(0.1) }

            expect { gp_pipe.run }.to raise_error(GpPipe::ImportFailed)
            lambda { gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}") }.should raise_error
          end

          it "drops the newly created table when there's an exception" do
            stub(gp_pipe).write_pipe do
              raise RuntimeError, "custom error"
            end
            stub(gp_pipe).read_pipe(anything) { sleep(0.1) }

            expect { gp_pipe.run }.to raise_error(GpPipe::ImportFailed)
          end
        end
      end

      context "into an existing table" do
        before do
          extra_options.merge!("new_table" => false)
        end

        it "creates a new pipe and runs it" do
          setup_data
          gpdb1.exec_query("create table #{gp_pipe.destination_table_fullname}(#{table_def});")
          gp_pipe.run
          gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 2
        end

        context "with a shorted timeout" do
          before do
            stub(GpPipe).grace_period_seconds { 1 }
          end

          it "does not drop the table when there's an exception" do
            stub(gp_pipe).write_pipe do
              while(true) do
                sleep(5)
              end
            end
            stub(gp_pipe).read_pipe(anything) { sleep(0.1) }

            setup_data
            gpdb1.exec_query("create table #{gp_pipe.destination_table_fullname}(#{table_def});")
            expect { gp_pipe.run }.to raise_error(GpPipe::ImportFailed)
            lambda { gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}") }.should_not raise_error
          end
        end

        context "when truncate => true" do
          it "should truncate" do
            extra_options.merge!("truncate" => 'true')
            setup_data
            gpdb1.exec_query("create table #{gp_pipe.destination_table_fullname}(#{table_def});")
            gpdb1.exec_query("insert into #{gp_pipe.destination_table_fullname}(id, name, id2, id3) values (21, 'kitkat-1', 41, 61);")
            gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 1
            gp_pipe.run
            gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 2
          end
        end

        context "when truncate => false" do
          it "does not truncate" do
            extra_options.merge!("truncate" => 'false')
            setup_data
            gpdb1.exec_query("create table #{gp_pipe.destination_table_fullname}(#{table_def});")
            gpdb1.exec_query("insert into #{gp_pipe.destination_table_fullname}(id, name, id2, id3) values (21, 'kitkat-1', 41, 61);")
            gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 1
            gp_pipe.run
            gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 3
          end
        end
      end

      context "from a chorus view" do
        let(:source_dataset) do
          cv = ChorusView.new({:name => "hello_view", :query => "select * from #{source_table_name}",
                              :schema_id => schema.id,
                              :workspace_id => workspace.id}, :without_protection => true)
          cv.save!(:validate => false)
          cv
        end

        before do
          extra_options.merge!("new_table" => true)
          setup_data
          stub(gpdb1).exec_query("delete from #{gp_pipe.source_table_fullname};") {true}
        end

        it "works like a normal dataset import" do
          gp_pipe.run
          gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 2
        end
      end
    end

    context "with distribution key" do
      let(:distrib_def) { 'DISTRIBUTED BY("id2", "id3")' }

      before do
        setup_data
      end
      it "should move data from candy to dst_candy and have the correct primary key and distribution key" do
        gp_pipe.run

        gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 2

        primary_key_sql = <<-PRIMARYKEYSQL
          SELECT attname
          FROM   (SELECT *, generate_series(1, array_upper(a, 1)) AS rn
          FROM  (SELECT conkey AS a
          FROM   pg_constraint where conrelid = '#{schema.name}.#{destination_table_name}'::regclass and contype='p'
          ) x
          ) y, pg_attribute WHERE attrelid = '#{schema.name}.#{destination_table_name}'::regclass::oid AND a[rn] = attnum ORDER by rn;
        PRIMARYKEYSQL

        gpdb2.exec_query(primary_key_sql)[0]['attname'].should == 'id2'
        gpdb2.exec_query(primary_key_sql)[1]['attname'].should == 'id3'
        gpdb2.exec_query(primary_key_sql)[2]['attname'].should == 'id'

        distribution_key_sql = <<-DISTRIBUTION_KEY_SQL
          SELECT attname
          FROM   (SELECT *, generate_series(1, array_upper(a, 1)) AS rn
          FROM  (SELECT attrnums AS a
          FROM   gp_distribution_policy where localoid = '#{schema.name}.#{destination_table_name}'::regclass
          ) x
          ) y, pg_attribute WHERE attrelid = '#{schema.name}.#{destination_table_name}'::regclass::oid AND a[rn] = attnum ORDER by rn;
        DISTRIBUTION_KEY_SQL

        # defaults to the first one
        gpdb2.exec_query(distribution_key_sql)[0]['attname'].should == 'id2'
        gpdb2.exec_query(distribution_key_sql)[1]['attname'].should == 'id3'
      end
    end

    context "limiting the number of rows" do
      let(:extra_options) { {"sample_count" => 1} }
      before do
        setup_data
      end

      it "should only have the first row" do
        gp_pipe.run

        rows = gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}")
        rows.length.should == 1
      end

      context "with a row limit of 0" do
        let(:extra_options) { {"sample_count" => 0} }

        it "doesn't hang gpfdist, by treating the source like an empty table" do
          stub(GpPipe).timeout_seconds { 10 }
          Timeout::timeout(5) do
            gp_pipe.run
          end

          gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 0
        end
      end
    end

    context "a sql query blocks forever" do
      before do
        stub(GpPipe).timeout_seconds { 1 }
        stub(gp_pipe.src_conn).exec_query { sleep(10); raise Exception, "test failed - no timeout" }
      end

      it "times out the query and raises a Timeout exception" do
        expect { gp_pipe.run }.to raise_exception(Timeout::Error)
      end
    end

    context "create external table does not succeed" do
      it "does not hang" do
        setup_data
        stub(GpPipe).write_protocol { 'gpfdistinvalid' }
        expect { gp_pipe.run }.to raise_error(GpPipe::ImportFailed)
      end
    end

    context "destination table already exists" do
      before do
        setup_data
        gpdb2.exec_query("CREATE TABLE #{gp_pipe.destination_table_fullname}(#{table_def})")
      end

      it "cleans up on an exception (in this case the dst table exists already)" do
        expect { gp_pipe.run }.to raise_exception
        count_result = gpdb1.exec_query("select count(*) from pg_tables where schemaname = '#{schema.name}' and tablename = '#{gp_pipe.pipe_name}';")
        count_result[0]['count'].should == 0
        count_result = gpdb2.exec_query("select count(*) from pg_tables where schemaname = '#{schema.name}' and tablename = '#{gp_pipe.pipe_name}';")
        count_result[0]['count'].should == 0
      end
    end

    context "tables have weird characters" do
      let(:source_table) { "2candy" }
      let(:destination_table_name) { "2dst_candy" }

      it "single quotes table and schema names if they have weird chars" do
        setup_data
        gp_pipe.run
        gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 2
      end
    end

    context "when #run failed" do
      before do
        stub(GpPipe).grace_period_seconds { 1 }
      end

      it "drops newly created the table when there's an exception" do
        stub(gp_pipe).write_pipe do
          while (true) do
            sleep(5)
          end
        end
        stub(gp_pipe).read_pipe(anything) { sleep(0.1) }

        setup_data
        lambda { gp_pipe.run }.should raise_error(GpPipe::ImportFailed)
      end
    end
  end

  context "when the source table is empty" do
    before do
      gpdb1.exec_query("delete from #{gp_pipe.source_table_fullname};")
      gpdb2.exec_query("drop table if exists #{gp_pipe.destination_table_fullname};")
    end

    after do
      gpdb1.exec_query("delete from #{gp_pipe.source_table_fullname};")
      gpdb2.exec_query("drop table if exists #{gp_pipe.destination_table_fullname};")
    end

    it "simply creates the dst table if the source table is empty (no gpfdist used)" do
      gp_pipe.run

      gpdb2.exec_query("SELECT * FROM #{gp_pipe.destination_table_fullname}").length.should == 0
    end
  end

  it "does not use special characters in the pipe names" do
    gp_pipe.pipe_name.should match(/^pipe_\d+_\d+$/)
  end
end