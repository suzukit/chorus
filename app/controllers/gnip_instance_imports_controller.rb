class GnipInstanceImportsController < ApplicationController
  wrap_parameters :import, :exclude => []

  def create
    workspace = Workspace.find(params['import']['workspace_id'])
    raise ApiValidationError.new(:base, :generic, {:message => "Workspace must have a sandbox"}) unless workspace.sandbox.present?

    authorize! :can_edit_sub_objects, workspace
    table_name = params['import']['to_table']

    temp_csv_file = workspace.csv_files.new(
        :to_table => table_name,
    )
    temp_csv_file.user = current_user
    if temp_csv_file.table_already_exists(table_name)
      raise ApiValidationError.new(:base, :table_exists, { :table_name => table_name })
    end

    gnip_instance = GnipInstance.find(params['gnip_instance_id'])
    event = create_import_event(temp_csv_file, gnip_instance)

    QC.enqueue_if_not_queued("GnipImporter.import_to_table",
               table_name,
               gnip_instance.id,
               workspace.id,
               current_user.id,
               event.id)

    render :json => [], :status => :ok
  end

  private

  def create_import_event(csv_file, gnip_instance)
    schema = csv_file.workspace.sandbox
    Events::GnipStreamImportCreated.by(csv_file.user).add(
        :workspace => csv_file.workspace,
        :destination_table => csv_file.to_table,
        :gnip_instance => gnip_instance
    )
  end
end