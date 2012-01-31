describe("chorus.models.DatabasePreview", function() {
    beforeEach(function() {
        this.model = new chorus.models.DatabasePreview({databaseName: "dataman", instanceId: "33", schemaName: "partyman"});
    });

    context("with a table name", function() {
        beforeEach(function() {
            this.model.set({tableName : "foo"});
        });
        it("should have the correct url template", function() {
            expect(this.model.url()).toBe("/edc/data/33/database/dataman/schema/partyman/table/foo/sample");
        });
    });

    context("with a view name", function() {
        beforeEach(function() {
            this.model.set({viewName : "bar"});
        });
        it("should have the correct url template", function() {
            expect(this.model.url()).toBe("/edc/data/33/database/dataman/schema/partyman/view/bar/sample");
        });
    });
});
