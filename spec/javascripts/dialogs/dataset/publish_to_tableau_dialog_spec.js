describe("chorus.dialogs.PublishToTableauDialog", function () {
    beforeEach(function () {
        this.dataset = rspecFixtures.workspaceDataset.datasetTable({objectName:"myDataset"});
        this.model = this.dataset.deriveTableauWorkbook();
        this.dialog = new chorus.dialogs.PublishToTableau({model:this.model, dataset: this.dataset});
        this.dialog.render();
    });

    it("populates the dataset name in the name input", function () {
        expect(this.dialog.$("input[name='name']").val()).toBe("myDataset");
        expect(this.dialog.$("label[name='name']").text()).toMatchTranslation("tableau.dialog.name");
    });

    it("has an empty and enabled 'Tableau Username' field", function() {
        expect(this.dialog.$("input[name=tableau_username]").val()).toBe("");
        expect(this.dialog.$("input[name=tableau_username]").prop("disabled")).toBeFalsy();
        expect(this.dialog.$("label[name='tableau_username']").text()).toMatchTranslation("tableau.dialog.username");
    });

    it("has an empty and enabled 'Tableau Password' field", function() {
        expect(this.dialog.$("input[name=tableau_password]").val()).toBe("");
        expect(this.dialog.$("input[name=tableau_password]").prop("disabled")).toBeFalsy();
        expect(this.dialog.$("label[name='tableau_password']").text()).toMatchTranslation("tableau.dialog.password");
    });


    it("checks the create workfile checkbox", function () {
        expect(this.dialog.$("input[name='create_work_file']")).toBeChecked();
    });

    it("unchecking the create workfile checkbox", function() {
        this.dialog.$("input[name='create_work_file']").attr('checked', false);
        this.dialog.$("button.submit").click();
        expect(this.dialog.$("input[name='create_work_file']")).not.toBeChecked();
    });

    describe("when publish is clicked", function () {
        beforeEach(function () {
            this.dialog.$("input[name='name']").val("foo");
            this.dialog.$("input[name='tableau_username']").val("fooname");
            this.dialog.$("input[name='tableau_password']").val("foopass");
            this.dialog.$("button.submit").click();
        });

        it("sets the name on the workbook", function () {
            expect(this.model.name()).toBe("foo");
        });

        it("sets the create_work_file on the workbook", function () {
            expect(this.model.get('createWorkFile')).toBe(true);
        });

        it("saves the workbook", function() {
            expect(this.server.lastCreateFor(this.model)).toBeDefined();
        });

        it("start the spinner on the button", function() {
           expect(this.dialog.$("button.submit").isLoading()).toBeTruthy();
        });

        describe("when the save succeeds", function() {
           beforeEach(function() {
               spyOn(chorus.Modal.prototype, "closeModal");
               spyOn(chorus, "toast");
               this.originalWorkbooksCount = this.dataset.tableauWorkbooks().length;
               this.server.lastCreateFor(this.model).succeed();
           });

           it("closes the modal", function() {
               expect(this.dialog.closeModal).toHaveBeenCalled();
           });

            it("toasts", function() {
                expect(chorus.toast).toHaveBeenCalledWith(
                    "tableau.published", {
                        objectType: "Table",
                        objectName: "myDataset",
                        name: "foo"
                    }
                );
            });

            it("updates the dataset", function() {
                expect(this.dataset.tableauWorkbooks().length).toBeGreaterThan(this.originalWorkbooksCount);
            });
        });

        describe("when the save fails", function() {
            beforeEach(function() {
                this.server.lastCreateFor(this.model).failUnprocessableEntity();
            });

            it("stops the spinner", function() {
               expect(this.dialog.$("button.submit").isLoading()).toBeFalsy();
            });
        });

    });
});