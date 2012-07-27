describe("chorus.presenters.DatasetSidebar", function() {
    describe("ellipsize", function() {
        it("ellipsizes a long string", function() {
            expect(chorus.presenters.DatasetSidebar.prototype.ellipsize("Hello my name is very long")).toBe("Hello my nam...");
        });

        it("doesn't ellipsize a short string", function() {
            expect(chorus.presenters.DatasetSidebar.prototype.ellipsize("Hello")).toBe("Hello");
        });

        it("returns an empty string when passed nothing", function() {
            expect(chorus.presenters.DatasetSidebar.prototype.ellipsize(undefined)).toBe("");
        });
    });

    describe("_linkToModel", function() {
        it("returns a link to a model", function() {
            var model = new chorus.models.User({ id: 5, firstName: "Tom", lastName: "Wood" });
            expect(chorus.presenters.DatasetSidebar.prototype._linkToModel(model)).toEqual({ string: '<a href="#/users/5" title="Tom Wood">Tom Wood</a>'});
        });
    });

    describe("the context", function() {
        context("with a regular dataset", function() {
            var presenter, sidebar, resource;
            beforeEach(function() {
                resource = rspecFixtures.dataset();
                sidebar = new chorus.views.DatasetSidebar({ model: resource });
                presenter = new chorus.presenters.DatasetSidebar(sidebar);
            });

            it("returns everything", function() {
                expect(presenter.canExport()).toBeFalsy();
                expect(presenter.hasImport()).toBeFalsy();
                expect(presenter.displayEntityType()).toEqual("table");
                expect(presenter.isChorusView()).toBeFalsy();
                expect(presenter.canAnalyze()).toBeTruthy();
                expect(presenter.noCredentials()).toBeFalsy();
                expect(presenter.noCredentialsWarning()).not.toBeEmpty();
                expect(presenter.typeString()).not.toBeEmpty();
                expect(presenter.workspaceId()).not.toBeEmpty();
                expect(presenter.hasSandbox()).toBeFalsy();
                expect(presenter.activeWorkspace()).toBeFalsy();
                expect(presenter.isDeleteable()).toBeFalsy();
                expect(presenter.deleteKey("deleteMsgKey")).not.toBeEmpty();
                expect(presenter.deleteKey("deleteTextKey")).not.toBeEmpty();
                expect(presenter.isImportConfigLoaded()).toBeFalsy();
                expect(presenter.hasSchedule()).toBeFalsy();
                expect(presenter.nextImport()).toBeFalsy();
                expect(presenter.inProgressText()).not.toBeEmpty();
                expect(presenter.importInProgress()).not.toBeEmpty();
                expect(presenter.importFailed()).not.toBeEmpty();
                expect(presenter.lastImport()).not.toBeEmpty();
            });
        });

        context("with a workspace table", function() {
            var presenter, sidebar, resource;
            beforeEach(function() {
                resource = rspecFixtures.workspaceDataset.datasetTable();
                resource.workspace()._sandbox = new chorus.models.Sandbox({ id : 123 })
                sidebar = new chorus.views.DatasetSidebar({ model: resource });
                presenter = new chorus.presenters.DatasetSidebar(sidebar);
            });

            it("returns everything", function() {
                expect(presenter.workspaceArchived()).toBeFalsy();
                expect(presenter.hasSandbox()).toBeTruthy();
                expect(presenter.workspaceId()).not.toBeEmpty();
                expect(presenter.activeWorkspace()).toBeTruthy();
            });
        });
    });
});