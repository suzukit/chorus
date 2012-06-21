class ActivityStreamEventMapper
  def initialize(activity_stream)
    @activity_stream = activity_stream
  end

  def build_event
    event = event_class.new
    set_target_objects(event)

    event
  rescue StandardError
    nil
  end

  def can_build?
    event_class.present?
  end

  private

  def event_class
    if @activity_stream.type == 'INSTANCE_CREATED'
      instance_event_class
    else
      "Events::#{@activity_stream.type}".constantize
    end
  rescue NameError => e
    nil
  end

  def instance_event_class
    if @activity_stream.instance_hadoop?
      Events::HADOOP_INSTANCE_CREATED
    else
      Events::GREENPLUM_INSTANCE_CREATED
    end
  end

  def set_target_objects(event)
    event.class.target_names.each do |target_name|
      event.public_send "#{target_name}=", get_target_object(target_name)
    end
  end

  def get_target_object(target_name)
    case target_name
    when :greenplum_instance
      Instance.find_by_id(@activity_stream.rails_greenplum_instance_id)
    when :hadoop_instance
      HadoopInstance.find_by_id(@activity_stream.rails_hadoop_instance_id)
    when :workfile
      Workfile.find_by_id(@activity_stream.rails_workfile_id)
    end
  end
end