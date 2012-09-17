require 'spec_helper'

describe ChorusViewsController, :database_integration => true do
  let(:account) { GpdbIntegration.real_gpdb_account }
  let(:user) { account.owner }
  let(:database) { GpdbDatabase.find_by_name_and_gpdb_instance_id(GpdbIntegration.database_name, GpdbIntegration.real_gpdb_instance)}
  let(:schema) { database.schemas.find_by_name('test_schema') }
  let(:workspace) { workspaces(:bob_public)}
  let(:dataset) { datasets(:bobs_table) }
  let(:workfile) { workfiles(:bob_public) }

  before do
    log_in user
  end

  context "#create" do
    context "when creating a chorus view from a dataset" do
      let(:options) {
        HashWithIndifferentAccess.new(
            :query => "Select * from base_table1",
            :schema_id => schema.id,
            :source_object_id => dataset.id,
            :source_object_type => 'dataset',
            :object_name => "my_chorus_view",
            :workspace_id => workspace.id
        )
      }

      it "creates a chorus view" do
        post :create, :chorus_view => options

        chorus_view = Dataset.chorus_views.last
        chorus_view.name.should == "my_chorus_view"
        workspace.bound_datasets.should include(chorus_view)

        response.code.should == "201"
        decoded_response[:query].should == "Select * from base_table1"
        decoded_response[:schema][:id].should == schema.id
        decoded_response[:object_name].should == "my_chorus_view"
        decoded_response[:workspace][:id].should == workspace.id
      end

      it "creates an event" do
        post :create, :chorus_view => options

        the_event = Events::Base.first
        the_event.action.should == "ChorusViewCreated"
        the_event.source_object.id.should == dataset.id
        the_event.source_object.should be_a(Dataset)
        the_event.workspace.id.should == workspace.id
      end

      generate_fixture "workspaceDataset/chorusView.json" do
        post :create, :chorus_view => options
      end
    end

    context "when creating a chorus view from a workfile" do
      let(:options) {
        HashWithIndifferentAccess.new(
            :query => "Select * from base_table1",
            :schema_id => schema.id,
            :source_object_id => workfile.id,
            :source_object_type => 'workfile',
            :object_name => "my_chorus_view",
            :workspace_id => workspace.id
        )
      }

      it "creates a chorus view" do
        post :create, :chorus_view => options

        chorus_view = Dataset.chorus_views.last
        chorus_view.name.should == "my_chorus_view"
        workspace.bound_datasets.should include(chorus_view)

        response.code.should == "201"
        decoded_response[:query].should == "Select * from base_table1"
        decoded_response[:schema][:id].should == schema.id
        decoded_response[:object_name].should == "my_chorus_view"
        decoded_response[:workspace][:id].should == workspace.id
      end

      it "creates an event" do
        post :create, :chorus_view => options

        the_event = Events::Base.first
        the_event.action.should == "ChorusViewCreated"
        the_event.source_object.id.should == workfile.id
        the_event.source_object.should be_a(Workfile)
        the_event.workspace.id.should == workspace.id
      end
    end

    context "when query is invalid" do
      let(:options) {
        HashWithIndifferentAccess.new(
            :query => "Select * from non_existing_table",
            :schema_id => schema.id,
            :object_name => "invalid_chorus_view",
            :workspace_id => workspace.id,
            :source_object_id => dataset.id,
            :source_object_type => 'dataset'
        )
      }

      it "responds with unprocessible entity" do
        post :create, :chorus_view => options
        response.code.should == "422"
        decoded = JSON.parse(response.body)
        decoded['errors']['fields']['query']['GENERIC'].should be_present
      end
    end
  end

  describe "#update" do
    let(:chorus_view) do
      FactoryGirl.create(:chorus_view,
        :schema => schema,
        :query => 'select 1;').tap { |c| c.bound_workspaces << workspace }
    end

    it "updates the definition of chorus view" do
      put :update, :workspace_dataset => {
          :id => chorus_view.to_param,
          :workspace_id => workspace.to_param,
          :query => 'select 2;'
      }
      response.should be_success
      decoded_response[:query].should == 'select 2;'
      chorus_view.reload.query.should == 'select 2;'
    end

    context "as a user who is not a workspace member" do
      let(:user) { FactoryGirl.create(:user) }

      it "does not allow updating the chorus view" do
        put :update, :workspace_dataset => {
            :id => chorus_view.to_param,
            :workspace_id => chorus_view.bound_workspaces.first,
            :query => 'select 2;'
        }
        response.should be_forbidden
        chorus_view.reload.query.should_not == 'select 2;'
      end
    end
  end
end
