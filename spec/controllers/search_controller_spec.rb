require 'spec_helper'

describe SearchController do
  describe "#show" do
    let(:user) { users(:owner) }

    before do
      log_in user
    end

    it_behaves_like "an action that requires authentication", :get, :show

    it "uses the search object" do
      fake_search = Object.new
      mock(Search).new(user, anything) do |_, params|
        params[:query].should == "marty"
        fake_search
      end
      mock_present { |model| model.should == fake_search }
      get :show, :query => 'marty'
    end

    generate_fixture "searchResult.json" do
      reindex_solr_fixtures

      VCR.use_cassette "search_solr_query_all_types_as_owner" do
        get :show, :query => 'searchquery'
      end
    end

    generate_fixture "emptySearchResult.json" do
      Sunspot.session = Sunspot.session.original_session
      VCR.use_cassette "search_solr_query_empty" do
        get :show, :query => 'hippopotomous'
      end
    end

    generate_fixture "searchResultWithEntityTypeUser.json" do
      reindex_solr_fixtures

      VCR.use_cassette "search_solr_query_user_as_owner" do
        get :show, :query => 'searchquery', :entity_type => 'user'
      end
    end

    generate_fixture "searchResultWithAttachmentOnInstanceNote.json" do
      reindex_solr_fixtures

      VCR.use_cassette "search_solr_query_attachment_on_instance" do
        get :show, :query => 'searchquery_instance'
      end
    end

    generate_fixture "searchResultWithAttachmentOnWorkspaceNote.json" do
      reindex_solr_fixtures

      VCR.use_cassette "search_solr_query_attachment_on_workspace" do
        get :show, :query => 'searchquery_workspace'
      end
    end

    generate_fixture "searchResultWithAttachmentOnWorkfileNote.json" do
      reindex_solr_fixtures

      VCR.use_cassette "search_solr_query_attachment_on_workfile" do
        get :show, :query => 'searchquery_workfile'
      end
    end

    generate_fixture "searchResultWithAttachmentOnDatasetNote.json" do
      reindex_solr_fixtures

      VCR.use_cassette "search_solr_query_attachment_on_dataset" do
        get :show, :query => 'searchquery_dataset'
      end
    end

    generate_fixture "searchResultWithAttachmentOnHadoopNote.json" do
      reindex_solr_fixtures

      VCR.use_cassette "search_solr_query_attachment_on_hadoop" do
        get :show, :query => 'searchquery_hadoop'
      end
    end

    generate_fixture "searchResultWithAttachmentOnHdfsNote.json" do
      reindex_solr_fixtures

      VCR.use_cassette "search_solr_query_attachment_on_hdfs" do
        get :show, :query => 'searchquery_hdfs_file'
      end
    end

    generate_fixture "searchResultWithAttachmentOnWorkspaceDatasetNote.json" do
      reindex_solr_fixtures

      VCR.use_cassette "search_solr_query_attachment_on_workspace_dataset" do
        get :show, :query => 'searchquery_workspace_dataset'
      end
    end
  end

  describe "#workspaces" do
    let(:user) { users(:no_collaborators) }
    let(:search_object) { Object.new }

    it_behaves_like "an action that requires authentication", :get, :workspaces

    context "when logged in" do
      before do
        log_in user
      end

      it "should search within the users workspaces and present the results" do
        stub(MyWorkspacesSearch).new(user, hash_including(:query => 'searchything')) { search_object }
        mock(@controller).present(search_object, :presenter_options => { :presenter_class => 'SearchPresenter' }) { @controller.render :json => {} }
        get :workspaces, :query => 'searchything'
      end
    end
  end

  describe "#type_ahead" do
    it_behaves_like "an action that requires authentication", :get, :type_ahead

    context "with a user" do
      let(:user) { users(:owner) }

      before do
        log_in user
      end

      it "uses the search object" do
        fake_search = Object.new
        mock(TypeAheadSearch).new(user, anything) do |_, params|
          params[:query].should == "marty"
          fake_search
        end
        mock_present { |model| model.should == fake_search }
        get :type_ahead, :query => 'marty'
      end

      generate_fixture "typeAheadSearchResult.json" do
        reindex_solr_fixtures

        VCR.use_cassette "type_ahead_search_fixture" do
          get :type_ahead, :query => 'typeahead', :per_page => 15
        end
      end
    end
  end

  describe "#reindex" do
    it_behaves_like "an action that requires authentication", :post, :reindex

    context "not admin" do
      before do
        log_in users(:no_collaborators)
      end

      it "should refuse" do
        post :reindex
        response.code.should == "403"
      end
    end

    context "as admin" do
      before do
        log_in users(:admin)
      end

      it "should enqueue the refresh" do
        mock(QC.default_queue).enqueue_if_not_queued("SolrIndexer.refresh_and_reindex", ['Dataset', 'GpdbInstance'])
        post :reindex, :types => ['Dataset', 'GpdbInstance']
        response.should be_success
      end

      it "should allow refresh of all searchable types" do
        mock(QC.default_queue).enqueue_if_not_queued("SolrIndexer.refresh_and_reindex", 'all')
        post :reindex
        response.should be_success
      end
    end
  end
end
