chorus.views.HdfsShowFileHeader = chorus.views.Base.extend({
    constructorName: "HdfsShowFileHeaderView",
    templateName: "hdfs_show_file_header",

    additionalContext: function() {
        return {
            iconUrl: this.model.iconUrl(),
            fileName: this.model.get("name")
        };
    }
});