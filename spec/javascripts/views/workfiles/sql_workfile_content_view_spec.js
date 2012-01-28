describe("chorus.views.SqlWorkfileContentView", function() {
    beforeEach(function() {
        this.workfile = fixtures.sqlWorkfile({ content: "select * from foos where bar_id = 1;" });
        spyOn(this.workfile, 'executionSchema').andReturn(fixtures.schema({
            id: '4',
            name: "schema",
            databaseId: '3',
            databaseName: "db",
            instanceId: '2',
            instanceName: "instance"
        }));
        this.view = new chorus.views.SqlWorkfileContent({model: this.workfile});
        stubDefer();
    })

    describe("initialization", function() {
        it("has a TextWorkfileContent view", function() {
            expect(this.view.textContent).toBeA(chorus.views.TextWorkfileContent);
        })

        it("has a ResultsConsole view", function() {
            expect(this.view.resultsConsole).toBeA(chorus.views.ResultsConsole);
        })

        it("delcares hotkeys", function() {
            expect(this.view.hotkeys.r).toBeDefined();
        })
    })

    describe("event forwarding", function() {
        beforeEach(function() {
            stubModals();
            this.view.render();
        })
        it("forwards the file:executionStarted event to the results console", function() {
            spyOnEvent(this.view.resultsConsole, "file:executionStarted");
            this.view.trigger("file:executionStarted");
            expect("file:executionStarted").toHaveBeenTriggeredOn(this.view.resultsConsole)
        })

        it("forwards the file:executionCompleted event to the results console", function() {
            spyOnEvent(this.view.resultsConsole, "file:executionCompleted");
            this.view.trigger("file:executionCompleted", fixtures.taskWithResult());
            expect("file:executionCompleted").toHaveBeenTriggeredOn(this.view.resultsConsole)
        })

        it("forwards file:saveCurrent events to the textContent subview", function() {
            spyOnEvent(this.view.textContent, "file:saveCurrent");
            this.view.trigger("file:saveCurrent");
            expect("file:saveCurrent").toHaveBeenTriggeredOn(this.view.textContent)
        })

        it("forwards file:createWorkfileNewVersion events to the textContent subview", function() {
            spyOnEvent(this.view.textContent, "file:createWorkfileNewVersion");
            this.view.trigger("file:createWorkfileNewVersion");
            expect("file:createWorkfileNewVersion").toHaveBeenTriggeredOn(this.view.textContent);
        });

        it("forwards file:insertText events to the textContent subview", function() {
            spyOnEvent(this.view.textContent, "file:insertText");
            this.view.trigger("file:insertText", "");
            expect("file:insertText").toHaveBeenTriggeredOn(this.view.textContent)
        });
    })

    describe("executing the workfile", function() {
        beforeEach(function() {
            this.view.render();
            this.view.textContent.editor.setValue("select * from foos");
            this.startedSpy = jasmine.createSpy("executionStarted")
            this.view.bind("file:executionStarted", this.startedSpy);
        });

        context("when no execution is outstanding", function() {
            describe("running in another schema", function() {
                beforeEach(function() {
                    this.view.trigger("file:runInSchema", {
                        instance: '4',
                        database: '5',
                        schema: '6'
                    })
                })

                it("creates a task with the right parameters", function() {
                    expect(this.view.task.get("sql")).toBe("select * from foos");
                    expect(this.view.task.get("instanceId")).toBe("4");
                    expect(this.view.task.get("databaseId")).toBe("5");
                    expect(this.view.task.get("schemaId")).toBe("6");
                    expect(this.view.task.get("entityId")).toBe(this.workfile.get("id"));
                    expect(this.view.task.has("checkId")).toBeTruthy();
                });
            })

            describe("running in the default schema", function() {
                beforeEach(function() {
                    this.view.trigger("file:runCurrent");
                })

                it("creates a task with the right parameters", function() {
                    expect(this.view.task.get("sql")).toBe("select * from foos");
                    expect(this.view.task.get("instanceId")).toBe("2");
                    expect(this.view.task.get("databaseId")).toBe("3");
                    expect(this.view.task.get("schemaId")).toBe("4");
                    expect(this.view.task.get("entityId")).toBe(this.workfile.get("id"));
                    expect(this.view.task.has("checkId")).toBeTruthy();
                });

                it("saves the task", function() {
                    expect(this.server.creates().length).toBe(1);
                    expect(this.server.lastCreate().url).toBe(this.view.task.url());
                });

                it("triggers file:executionStarted on the view", function() {
                    expect(this.startedSpy).toHaveBeenCalledWith(jasmine.any(chorus.models.Task));
                })

                describe("when the task completes successfully", function() {
                    beforeEach(function() {
                        this.completionSpy = jasmine.createSpy("executionCompleted")
                        this.view.bind("file:executionCompleted", this.completionSpy);
                        this.server.lastCreate().succeed([{
                            id : "10100",
                            state : "success",
                            result : {
                                message : "hi there"
                            }
                        }]);
                    })

                    it('triggers file:executionCompleted on the view', function() {
                        expect(this.completionSpy).toHaveBeenCalledWith(jasmine.any(chorus.models.Task));
                    })

                    describe("executing again", function() {
                        beforeEach(function() {
                            this.view.trigger("file:runCurrent");
                        })

                        it("executes the task again", function() {
                            expect(this.server.creates().length).toBe(2);
                        })
                    })
                })
            });

            context("when an execution is already outstanding", function() {
                beforeEach(function() {
                    this.view.trigger("file:runCurrent");
                    this.startedSpy.reset();
                    this.view.trigger("file:runCurrent");
                })

                it('does not start a new execution', function() {
                    expect(this.startedSpy).not.toHaveBeenCalled();
                })
            })
        })
    });
});
