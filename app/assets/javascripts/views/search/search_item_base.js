chorus.views.SearchItemBase = chorus.views.Base.extend({
    tagName: "li",
    additionalClass: "result_item",

    events: {
        "click a.show_more_comments": "showMoreComments",
        "click a.show_fewer_comments": "showFewerComments",
        "click": "itemSelected"
    },

    postRender: function() {
        var commentsView = this.makeCommentList();
        this.$(".comments_container").append(commentsView.render().el);
    },

    makeCommentList: function() {
        return new chorus.views.SearchResultCommentList({comments: this.getComments(), columns: this.getColumns(),
            columnDescriptions: this.getColumnDescriptions(), tableDescription: this.getTableDescription()});
    },

    getTableDescription: function() {
        var descriptions = this.model.get("tableDescription") || [];
        _.each(descriptions, function(description) { description.isTableDescription = true; });

        return descriptions;
    },

    getColumns: function() {
        var columns = this.model.get("columns") || [];
        _.each(columns, function(column) { column.isColumn = true; });

        return columns;
    },

    getColumnDescriptions: function() {
        var columnDescriptions = this.model.get("columnDescriptions") || [];
        _.each(columnDescriptions, function(columnDescription) { columnDescription.isColumnDescription = true; });

        return columnDescriptions;
    },

    getComments: function() {
        return this.model.get("comments") || [];
    },

    showMoreComments: function(evt) {
        evt && evt.preventDefault();
        this.$(".has_more_comments").addClass("hidden");
        this.$(".more_comments").removeClass("hidden");
    },

    showFewerComments: function(evt) {
        evt && evt.preventDefault();
        this.$(".has_more_comments").removeClass("hidden");
        this.$(".more_comments").addClass("hidden");
    },

    itemSelected: function(evt) {
        var preSelected = $(evt.target).hasClass("selected");
        if(!preSelected) {
            this.options.search.selectedItem = this.model;
            chorus.PageEvents.broadcast(this.eventType + ":selected", this.model);
        }
    }
});