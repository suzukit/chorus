describe("chorus.dialogs.InstanceNew", function() {
    beforeEach(function() {
        this.launchElement = $("<button/>");
        this.dialog = new chorus.dialogs.InstancesNew({launchElement: this.launchElement});
    });

    describe("#render", function() {
        beforeEach(function() {
            $('#jasmine_content').append(this.dialog.el);
            this.dialog.render();
        });

        it("has radio buttons for 'register an existing instance' and 'register hadoop file system'", function() {
            expect(this.dialog.$("input[type=radio]").length).toBe(2);
            expect(this.dialog.$("label[for=register_existing_greenplum]").text()).toMatchTranslation("instances.new_dialog.register_existing_greenplum");
            expect(this.dialog.$("label[for=register_existing_hadoop]").text()).toMatchTranslation("instances.new_dialog.register_existing_hadoop");
        });

        it("starts with no radio buttons selected", function() {
            expect(this.dialog.$("input[type=radio]:checked").length).toBe(0);
        });

        it("starts with all fieldsets collapsed", function() {
            expect(this.dialog.$("fieldset").not(".collapsed").length).toBe(0);
        });

        it("starts with the submit button disabled", function() {
            expect(this.dialog.$("button.submit")).toBeDisabled();
        });

        context("when aurora is installed", function() {
            beforeEach(function() {
                chorus.models.Instance.aurora().set({ installationStatus: "install_succeed"});
                this.dialog.render();
            });

            it("enables create a new Greenplum database instance", function() {
                expect(this.dialog.$(".create_new_greenplum input[type=radio]")).toExist();
            });

            it("shows the correct text", function() {
                expect(this.dialog.$("label[for=create_new_greenplum]").text()).toMatchTranslation("instances.new_dialog.create_new_greenplum")
            });

            it("doesn't have class disabled", function() {
                expect(this.dialog.$("label[for=create_new_greenplum]")).not.toHaveClass("disabled");
            });
        });

        context("when aurora is not installed", function() {
            beforeEach(function() {
                chorus.models.Instance.aurora().set({ installationStatus: "not_installed"});
                this.dialog.render();
            });

            it("does not show the 'create a new Greenplum database instance' option", function() {
                expect(this.dialog.$(".create_new_greenplum input[type=radio]")).not.toExist();
            });
        });

        describe("selecting the 'register an existing instance' radio button", function() {
            beforeEach(function() {
                this.dialog.$("input[type=radio]#register_existing_greenplum").attr('checked', true).change();
            });

            it("un-collapses the 'register an existing instance' fieldset", function() {
                expect(this.dialog.$("fieldset").not(".collapsed").length).toBe(1);
                expect(this.dialog.$("fieldset.register_existing_greenplum")).not.toHaveClass("collapsed");
            });

            it("enables the submit button", function() {
                expect(this.dialog.$("button.submit")).toBeEnabled();
            });

            it("uses 'postgres' as the default database name", function() {
                expect(this.dialog.$(".register_existing_greenplum input[name=maintenanceDb]").val()).toBe("postgres");
            });

            describe("filling out the form", function() {
                beforeEach(function() {
                    this.dialog.$(".register_existing_greenplum input[name=name]").val("Instance_Name");
                    this.dialog.$(".register_existing_greenplum textarea[name=description]").val("Instance Description");
                    this.dialog.$(".register_existing_greenplum input[name=host]").val("foo.bar");
                    this.dialog.$(".register_existing_greenplum input[name=port]").val("1234");
                    this.dialog.$(".register_existing_greenplum input[name=dbUserName]").val("user");
                    this.dialog.$(".register_existing_greenplum input[name=dbPassword]").val("my_password");
                    this.dialog.$(".register_existing_greenplum input[name=maintenanceDb]").val("foo");

                    this.dialog.$(".register_existing_greenplum input[name=name]").trigger("change");
                });

                it("should return the values in fieldValues", function() {
                    var values = this.dialog.fieldValues();
                    expect(values.name).toBe("Instance_Name");
                    expect(values.description).toBe("Instance Description");
                    expect(values.host).toBe("foo.bar");
                    expect(values.port).toBe("1234");
                    expect(values.dbUserName).toBe("user");
                    expect(values.dbPassword).toBe("my_password");
                    expect(values.maintenanceDb).toBe("foo");
                });
            });
        });

        describe("selecting the 'register a hadoop file system' radio button", function() {
            beforeEach(function() {
                this.dialog.$("input[type=radio]#register_existing_hadoop").attr('checked', true).change();
            });

            it("un-collapses the 'register a hadoop file system' fieldset", function() {
                expect(this.dialog.$("fieldset").not(".collapsed").length).toBe(1);
                expect(this.dialog.$("fieldset.register_existing_hadoop")).not.toHaveClass("collapsed");
            });

            it("enables the submit button", function() {
                expect(this.dialog.$("button.submit")).toBeEnabled();
            });

            describe("filling out the form", function() {
                beforeEach(function() {
                    var form = this.dialog.$(".register_existing_hadoop");
                    form.find("input[name=name]").val("Instance_Name");
                    form.find("textarea[name=description]").val("Instance Description");
                    form.find("input[name=host]").val("foo.bar");
                    form.find("input[name=port]").val("1234");
                    form.find("input[name=userName]").val("user");
                    form.find("input[name=userGroups]").val("hadoop");

                    form.find("input[name=name]").trigger("change");
                });

                it("#fieldValues returns the values", function() {
                    var values = this.dialog.fieldValues();
                    expect(values.name).toBe("Instance_Name");
                    expect(values.description).toBe("Instance Description");
                    expect(values.host).toBe("foo.bar");
                    expect(values.port).toBe("1234");
                    expect(values.userName).toBe("user");
                    expect(values.userGroups).toBe("hadoop");
                });

                it("#fieldValues should have the right values for 'provisionType' and 'shared'", function() {
                    var values = this.dialog.fieldValues();
                    expect(values.provisionType).toBe("registerHadoop");
                    expect(values.shared).toBe("yes");
                });
            });
        });

        describe("submitting the form", function() {
            beforeEach(function() {
                chorus.models.Instance.aurora().set({ installationStatus: "install_succeed"});
                this.dialog.render();
            });

            context("using register existing greenplum database", function() {
                beforeEach(function() {
                    this.dialog.$(".register_existing_greenplum input[type=radio]").attr('checked', true).change();
                });

                context("after filling in the form", function() {
                    beforeEach(function() {
                        this.dialog.$(".register_existing_greenplum input[name=name]").val("Instance_Name");
                        this.dialog.$(".register_existing_greenplum textarea[name=description]").val("Instance Description");
                        this.dialog.$(".register_existing_greenplum input[name=host]").val("foo.bar");
                        this.dialog.$(".register_existing_greenplum input[name=port]").val("1234");
                        this.dialog.$(".register_existing_greenplum input[name=dbUserName]").val("user");
                        this.dialog.$(".register_existing_greenplum input[name=dbPassword]").val("my_password");
                        this.dialog.$(".register_existing_greenplum input[name=maintenanceDb]").val("foo");

                        this.dialog.$(".register_existing_greenplum input[name=name]").trigger("change");

                        spyOn(this.dialog.model, "save").andCallThrough();
                    });

                    it("calls save on the dialog's model", function() {
                        this.dialog.$("button.submit").click();
                        expect(this.dialog.model.save).toHaveBeenCalled();

                        var attrs = this.dialog.model.save.calls[0].args[0];

                        expect(attrs.dbPassword).toBe("my_password");
                        expect(attrs.name).toBe("Instance_Name");
                        expect(attrs.provisionType).toBe("register");
                        expect(attrs.description).toBe("Instance Description");
                        expect(attrs.maintenanceDb).toBe("foo");
                    });

                    testUpload();
                });
            });

            context("using a new Greenplum database instance", function() {
                beforeEach(function() {
                    this.dialog.$(".create_new_greenplum input[type=radio]").attr('checked', true).change();
                    this.dialog.$(".create_new_greenplum input[name=name]").val("new_greenplum_instance");
                    this.dialog.$(".create_new_greenplum textarea[name=description]").val("Instance Description");
                    this.dialog.$(".create_new_greenplum input[name=size]").val("1");
                    this.dialog.$(".create_new_greenplum input[name=databaseName]").val("dbTest");
                    this.dialog.$(".create_new_greenplum input[name=schemaName]").val("schemaTest");
                });

                context("saving", function() {
                    beforeEach(function() {
                        spyOn(this.dialog.model, "save").andCallThrough();
                    });

                    it("calls save on the dialog's model", function() {
                        this.dialog.$("button.submit").click();
                        expect(this.dialog.model.save).toHaveBeenCalled();

                        var attrs = this.dialog.model.save.calls[0].args[0];

                        expect(attrs.size).toBe("1");
                        expect(attrs.name).toBe("new_greenplum_instance");
                        expect(attrs.provisionType).toBe("create");
                        expect(attrs.description).toBe("Instance Description");
                        expect(attrs.databaseName).toBe("dbTest");
                        expect(attrs.schemaName).toBe("schemaTest");
                    });

                    context("when other forms fields from registering an existing greenplum are filled", function() {
                        beforeEach(function() {
                            this.dialog.$("button.submit").click();

                            this.dialog.$(".register_existing_greenplum input[name=name]").val("existing");
                            this.dialog.$(".register_existing_greenplum textarea[name=description]").val("existing description");
                            this.dialog.$(".register_existing_greenplum input[name=host]").val("foo.bar");
                        });
                        it("sets only the fields for create new greenplum instance and calls save", function() {
                            expect(this.dialog.model.save).toHaveBeenCalled();

                            var attrs = this.dialog.model.save.calls[0].args[0];

                            expect(attrs.size).toBe("1");
                            expect(attrs.name).toBe("new_greenplum_instance");
                            expect(attrs.provisionType).toBe("create");
                            expect(attrs.description).toBe("Instance Description");
                            expect(attrs.host).toBeUndefined();
                        });
                    });
                });

                testUpload();
            });

            context("when the form is not valid", function() {
                beforeEach(function() {
                    this.dialog.$(".register_existing_greenplum input[type=radio]").attr('checked', true).change();
                    spyOn(Backbone.Model.prototype, 'save');
                    this.dialog.$("button.submit").click();
                });

                it("doesn't complete a save", function() {
                    expect(Backbone.Model.prototype.save).not.toHaveBeenCalled();
                });
            });

            function testUpload() {
                context("#upload", function() {
                    beforeEach(function() {
                        this.dialog.$("button.submit").click();
                    });

                    it("puts the button in 'loading' mode", function() {
                        expect(this.dialog.$("button.submit").isLoading()).toBeTruthy();
                    });

                    it("changes the text on the upload button to 'saving'", function() {
                        expect(this.dialog.$("button.submit").text()).toMatchTranslation("instances.new_dialog.saving");
                    });

                    it("does not disable the cancel button", function() {
                        expect(this.dialog.$("button.cancel")).not.toBeDisabled();
                    });

                    context("when save completes", function() {
                        beforeEach(function() {
                            spyOn(chorus.PageEvents, 'broadcast');
                            spyOn(this.dialog, "closeModal");

                            this.dialog.model.set({id: "123"});
                            this.dialog.model.trigger("saved");
                        });

                        it("closes the dialog", function() {
                            expect(this.dialog.closeModal).toHaveBeenCalled();
                        });

                        it("publishes the 'instance:added' page event with the new instance's id", function() {
                            expect(chorus.PageEvents.broadcast).toHaveBeenCalledWith("instance:added", "123");
                        });
                    });

                    context("when the upload gives a server error", function() {
                        beforeEach(function() {
                            this.dialog.model.set({serverErrors: [
                                { message: "foo" }
                            ]});
                            this.dialog.model.trigger("saveFailed");
                        });

                        it("display the correct error", function() {
                            expect(this.dialog.$(".errors").text()).toContain("foo");
                        });

                        itRecoversFromError();
                    });

                    context("when the validation fails", function() {
                        beforeEach(function() {
                            this.dialog.model.trigger("validationFailed");
                        });

                        itRecoversFromError();
                    });

                    function itRecoversFromError() {
                        it("takes the button out of 'loading' mode", function() {
                            expect(this.dialog.$("button.submit").isLoading()).toBeFalsy();
                        });

                        it("sets the button text back to 'Uploading'", function() {
                            expect(this.dialog.$("button.submit").text()).toMatchTranslation("instances.new_dialog.save");
                        });
                    }
                });
            }
        });
    });

    describe("the help text tooltip", function() {
        beforeEach(function() {
            spyOn($.fn, 'qtip');
            this.dialog.render();
            this.qtipCall = $.fn.qtip.calls[0];
        });

        it("makes a tooltip for each help", function() {
            expect($.fn.qtip).toHaveBeenCalled();
            expect(this.qtipCall.object).toBe(".help");
        });

        it("renders a help text", function() {
            expect(this.qtipCall.args[0].content).toMatchTranslation("instances.new_dialog.register_existing_greenplum_help_text");
        });
    });
});
