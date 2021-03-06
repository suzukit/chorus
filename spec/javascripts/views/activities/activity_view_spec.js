describe("chorus.views.Activity", function() {
    beforeEach(function () {
        stubDefer();
        this.model = rspecFixtures.activity.greenplumInstanceCreated();
        this.view = new chorus.views.Activity({ model:this.model });
    });

    describe("html content", function () {
        describe("#show", function () {
            beforeEach(function () {
                this.model = rspecFixtures.activity.noteOnGreenplumInstanceCreated();
                this.view = new chorus.views.Activity({ model:this.model });
                this.view.render();

                spyOn(this.view.htmlContent, "show");
            });

            it("calls show on the truncated text", function () {
                this.view.show();
                expect(this.view.htmlContent.show).toHaveBeenCalled();
            });
        });

        context("when the activity is a note", function () {
            beforeEach(function () {
                this.model = rspecFixtures.activity.noteOnGreenplumInstanceCreated();
                this.view = new chorus.views.Activity({ model:this.model });
                this.view.render();
            });

            it("displays the body as html", function () {
                expect(this.view.$(".activity_content .body")).not.toExist();
                expect(this.view.$(".activity_content .truncated_text")).toExist();
                expect(this.view.$(".activity_content .truncated_text .styled_text")).toContainText(this.model.get("body"));
                expect(this.view.htmlContent).toBeA(chorus.views.TruncatedText);
                expect(this.view.htmlContent.options.attributeIsHtmlSafe).toBeTruthy();
            });
        });

        context("when the activity's action is workfile upgrade versionwith a commit message", function () {
            beforeEach(function () {
                this.model = rspecFixtures.activity.workfileUpgradedVersion();
                this.view = new chorus.views.Activity({ model:this.model });
                this.view.render();
            });

            it("displays the body as truncated text", function () {
                expect(this.view.$(".activity_content .body")).not.toExist();
                expect(this.view.$(".activity_content .truncated_text")).toExist();
                expect(this.view.$(".activity_content .truncated_text .styled_text")).toContainText(this.model.get("commitMessage"));
                expect(this.view.htmlContent).toBeA(chorus.views.TruncatedText);
            });
        });

        context("when the activity is a failure", function () {
            beforeEach(function () {
                this.model = rspecFixtures.activity.fileImportFailed();
                this.view = new chorus.views.Activity({ model:this.model });
                this.view.render();
            });

            it("displays a link to the error message", function () {
                expect(this.view.$(".timestamp")).toContainText("ago");
                expect(this.view.$(".activity_content .actions")).toExist();
                expect(this.view.$(".activity_content .actions .error_details .details")).toExist();
                expect(this.view.$(".activity_content .actions .error_details .details")).toContainText(t("activity.view_error_details"));
                expect(this.view.failureContent).toBeA(chorus.views.ErrorDetails);
            });
        });

        xcontext("when the activity is an insight", function () {
            beforeEach(function () {
                this.model = fixtures.activities.INSIGHT_CREATED();
                this.view = new chorus.views.Activity({ model:this.model });
                this.view.render();
            });

            it("displays the content as html", function () {
                expect(this.view.$(".activity_content .truncated_text")).toExist();
                expect(this.view.$(".activity_content .truncated_text .styled_text")).toContainText(this.model.get("body"));
                expect(this.view.$(".activity_content .body")).not.toExist();
                expect(this.view.htmlContent).toBeA(chorus.views.TruncatedText);
                expect(this.view.htmlContent.options.attributeIsHtmlSafe).toBeTruthy();
            });
        });

        context("when the activity is something else", function () {
            beforeEach(function () {
                this.model = rspecFixtures.activity.fileImportSuccess();
                this.view = new chorus.views.Activity({ model:this.model });
                this.view.render();
            });

            it("does not display html content", function () {
                expect(this.view.$(".activity_content .truncated_text")).not.toExist();
                expect(this.view.htmlContent).toBeUndefined();
            });
        });
    });

    describe("#render", function () {
        beforeEach(function () {
            this.presenter = new chorus.presenters.Activity(this.model);
            spyOn(chorus.presenters, "Activity").andReturn(this.presenter);

            spyOn(this.presenter, "headerHtml").andReturn("A nice header.");
            spyOn(this.presenter, "timestamp").andReturn("A nice timestamp.");
            spyOn(this.presenter, "iconSrc").andReturn("a/nice/icon/src");
            spyOn(this.presenter, "iconHref").andReturn("a/nice/icon/href");
            spyOn(this.presenter, "iconClass").andReturn("a-nice-icon-class");

            this.view.render();
        });

        it("uses the activity presenter", function () {
            expect(chorus.presenters.Activity).toHaveBeenCalledWith(this.model, jasmine.any(Object));
        });

        it("it puts the ID on the view element", function () {
            expect($(this.view.el)).toHaveData("activityId", this.model.get("id"));
        });

        it("renders the icon based on the presenter", function () {
            var link = this.view.$(".icon a");
            var icon = link.find("img");
            expect(link).toHaveAttr("href", "a/nice/icon/href");
            expect(icon).toHaveAttr("src", "a/nice/icon/src");
            expect(icon).toHaveClass("a-nice-icon-class");
        });

        it("renders the header and timestamp from the presenter", function () {
            expect(this.view.$(".activity_header")).toContainText("A nice header.");
            expect(this.view.$(".timestamp")).toContainText("A nice timestamp.");
        });

        describe("for notes", function () {
            beforeEach(function () {
                this.model = this.presenter.model = rspecFixtures.activity.noteOnGreenplumInstanceCreated();
                this.view = new chorus.views.Activity({ model:this.model });
            });

            it("displays a delete link or not, based on the presenter", function () {
                spyOn(this.presenter, "canDelete").andReturn(true);
                this.view.render();
                expect(this.view.$("a.delete_link")).toExist();

                this.presenter.canDelete.andReturn(false);
                this.view.render();
                expect(this.view.$("a.delete_link")).not.toExist();
            });

            it("displays an edit link or not, based on the presenter", function () {
                spyOn(this.presenter, "canEdit").andReturn(true);
                this.view.render();
                expect(this.view.$("a.edit_link")).toExist();

                this.presenter.canEdit.andReturn(false);
                this.view.render();
                expect(this.view.$("a.edit_link")).not.toExist();
            });

            itShouldRenderAPromoteLink();

            context("when the note is already an insight", function () {
                beforeEach(function () {
                    this.model = this.presenter.model = rspecFixtures.activity.insightOnGreenplumInstance();
                    this.view = new chorus.views.Activity({ model:this.model });
                });

                itShouldNotRenderAPromoteLink();
                
                it("displays the note's promotion details if it is an insight", function () {
                    this.view.render();
                    expect(this.view.$("span.promoted_by")).toExist();
                });
            });
        });

        xcontext("isNotification", function () {
            beforeEach(function () {
                this.presenter = new chorus.presenters.Activity(this.view.model);
                this.view.model = rspecFixtures.activity.noteOnWorkspaceCreated();
                this.view.options.isNotification = true;
                this.view.render();
            });

            it("should have a NotificationDeleteAlert", function () {
                expect(this.view.$("a[data-alert=NotificationDeleteAlert]")).toExist();
            });
        });

        xdescribe("attachment rendering", function () {
            it("displays info for each attached file", function () {
                var attachmentLis = this.view.$("ul.attachments li");
                expect(attachmentLis.length).toBe(2);

                expect(attachmentLis.eq(0).find('a')).toHaveAttr('href', '/file/10101')
                expect(attachmentLis.eq(0).find('img')).toHaveAttr('src', chorus.urlHelpers.fileIconUrl("SQL", "medium"))
                expect(attachmentLis.eq(0).find('.name').text().trim()).toBe("something.sql")

                expect(attachmentLis.eq(1).find('a')).toHaveAttr('href', '/file/10102')
                expect(attachmentLis.eq(1).find('img')).toHaveAttr('src', chorus.urlHelpers.fileIconUrl("TXT", "medium"))
                expect(attachmentLis.eq(1).find('.name').text().trim()).toBe("something.txt")
            });
        });

        describe("comment rendering", function () {
            beforeEach(function () {
                spyOn(chorus, "cachebuster").andReturn(555);
                var comments = this.model.comments();
                var comment1 = new chorus.models.Comment({
                    author:{
                        id:10101,
                        fullName:"John Commenter",
                        image:{icon:"foo"}
                    },
                    text:'I love you all',
                    eventId: this.model.id
                });

                var comment2 = new chorus.models.Comment({
                    author:{
                        id:10102,
                        fullName:"Jane Commenter",
                        image:{icon:"bar"}
                    },
                    text:'I do too',
                    eventId: this.model.id
                });
                comments.add([ comment1, comment2 ]);

                this.view.render();
            });

            it("displays comments", function () {
                expect(this.view.$(".comments")).toExist();
                expect(this.view.$(".comments li").length).toBe(2);
            });

            it("displays information for each comment", function () {
                var commentLis = this.view.$(".comments li");
                var comments = this.model.comments();
                expect(commentLis.length).toBe(comments.length);

                expect(commentLis.eq(0).find(".icon a")).toHaveAttr("href", comments.at(0).author().showUrl());
                expect(commentLis.eq(0).find(".icon a img")).toHaveAttr("src", comments.at(0).author().fetchImageUrl());
                expect(commentLis.eq(0).find(".comment_header a")).toHaveText(comments.at(0).author().displayName());
                expect(commentLis.eq(0).find(".comment_content .actions .timestamp")).toExist();

                expect(commentLis.eq(1).find(".icon a")).toHaveAttr("href", comments.at(1).author().showUrl());
                expect(commentLis.eq(1).find(".icon a img")).toHaveAttr("src", comments.at(1).author().fetchImageUrl());
                expect(commentLis.eq(1).find(".comment_header a")).toHaveText(comments.at(1).author().displayName());
                expect(commentLis.eq(1).find(".comment_content .timestamp")).toExist();
            });

            context("when there are less than three comments", function () {
                it("does not render a 'more comments' link", function () {
                    expect(this.view.$(".morelinks a.more")).not.toExist();
                })

                it("does not apply the 'more' class to any comments", function () {
                    expect(this.view.$(".comments li.more")).not.toExist();
                });
            });

            context("when there are three or more comments", function () {
                beforeEach(function () {
                    var comments = this.model.comments();
                    comments.add([
                        new chorus.models.Comment({
                            author:{
                                id:10102
                            },
                            text:'I love you all',
                            eventId: this.model.id
                        }),
                        new chorus.models.Comment({
                            author:{
                                id:10103
                            },
                            text:'I love you all',
                            eventId: this.model.id
                        })
                    ]);
                    this.view.render();
                });

                it("renders a 'more comments' link", function () {
                    expect(this.view.$(".comments ul.morelinks a")).toExist();
                });

                it("applies the 'more' class to trailing elements", function () {
                    expect(this.view.$(".comments li:eq(0)")).toHaveClass("more");
                    expect(this.view.$(".comments li:eq(1)")).toHaveClass("more");
                    expect(this.view.$(".comments li:eq(2)")).not.toHaveClass("more");
                    expect(this.view.$(".comments li:eq(3)")).not.toHaveClass("more");
                });
            });

            context("when adding a comment", function() {
                beforeEach(function() {
                   this.newComment = new chorus.models.Comment({
                       id: 12345,
                       author:{
                           id:10102
                       },
                       text:'I love you all',
                       eventId: this.model.id
                   });

                    expect(this.view.$(".comments ul .morelinks a")).not.toExist();
                    expect(this.view.$(".comments li").length).toBe(2);

                    chorus.PageEvents.broadcast("comment:added", this.newComment);
                });

                it("updates the comment list", function() {
                    expect(this.view.$(".comments ul.morelinks a")).toExist();
                    expect(this.view.model.comments().length).toBe(3);
                });

                it("won't try to add the same comment twice", function() {
                    chorus.PageEvents.broadcast("comment:added", this.newComment);
                    expect(this.view.model.comments().length).toBe(3);
                });
            });
        });

        it("displays a comment link", function () {
            var link = this.view.$(".links a.comment.dialog");
            expect(link.data("dialog")).toBe("Comment");
            expect(link.data("event-id").toString()).toEqual(this.model.id);
        });

        xcontext("isReadOnly", function () {
            beforeEach(function () {
                setLoggedInUser({ id:this.view.model.author().id })
                this.presenter = new chorus.presenters.Activity(this.view.model);
                this.view.model = rspecFixtures.activity.noteOnWorkspaceCreated();
                this.view.options.isReadOnly = true;
                this.view.render();
            });

            it("should not render comments", function () {
                expect(this.view.$(".comment_list")).not.toExist();
            });

            it("should not render the links", function () {
                expect(this.view.$(".activity_content > .links")).not.toExist();
            });

            itDoesNotDisplayDeleteLink();
            itDoesNotDisplayEditLink();
        });
    });

    function itDisplaysDeleteLink() {
        it("displays a delete link", function () {
            var deleteLink = this.view.$(".activity_content .delete_link");
            expect(editLink).toHaveClass("dialog");
            expect(editLink).toHaveData("dialog", "DeleteNoteConfirmAlert");
            expect(deleteLink).toHaveData("activity", this.view.model);
        });
    }

    function itDoesNotDisplayDeleteLink() {
        it("does not display a delete link", function () {
            expect(this.view.$(".activity_content .delete_link")).not.toExist();
        });
    }

    function itRendersEditLink() {
        it("displays an edit link", function () {
            var editLink = this.view.$(".activity_content .edit_link");
            expect(editLink.text()).toMatchTranslation("actions.edit");
            expect(editLink).toHaveClass("dialog");
            expect(editLink).toHaveData("dialog", "EditNote");
            expect(editLink).toHaveData("activity", this.view.model);
        });
    }

    function itDoesNotDisplayEditLink() {
        it("does not display an edit link", function () {
            expect(this.view.$(".activity_content .edit_link")).not.toExist();
        });
    }

    function itShouldRenderVersionDetails(options) {
        options || (options = {});

        it("contains the version's name", function () {
            expect(this.view.$(".activity_header")).toContainText(this.presenter.versionName);
        });

        if (options.checkLink) {
            it("contains the version's url", function () {
                expect(this.view.$('.activity_header a[href="' + this.presenter.versionUrl + '"]')).toExist();
            });
        }
    }

    function itShouldNotRenderAPromoteLink() {
        it("does *not* have a link to promote the activity to a comment", function () {
            this.view.render();
            expect(this.view.$(".links a.promote")).not.toExist();
        });
    }

    function itShouldRenderAPromoteLink() {
        it("does have a link to promote the activity to a comment", function () {
            this.view.render();
            expect(this.view.$(".links a.promote")).toExist();
        });

        describe("when the promotion link is clicked", function() {
            beforeEach(function() {
                this.model.collection = chorus.collections.ActivitySet.forDashboard([this.model]);
                this.view.render();
                this.view.$("a.promote").click();
            });

            context("when the promotion completes", function() {
                beforeEach(function() {
                    this.view.$("a.promote").click();
                    this.server.lastCreate().succeed();
                });

                it("re-fetches the activities", function() {
                    expect(this.model.collection).toHaveBeenFetched();
                });
            });
        });
    }

    function itShouldRenderACommentLink(entityType, entityTitle) {
        it("sets the correct entityType on the comment dialog link", function () {
            expect(this.view.$("a.comment").data("entity-type")).toBe(entityType);
        })

        it("sets the correct entityTitle on the comment dialog link", function () {
            expect(this.view.$("a.comment").data("entity-title")).toBe(entityTitle)
        })
    }

    function itShouldRenderPublishOrUnpublishLinks() {
        context("when it is published", function () {
            beforeEach(function () {
                this.view.model.set({isPublished:true});
                this.view.render();
            });

            it("should have a link to unpublish", function () {
                expect(this.view.$("a.unpublish")).toExist();
                expect(this.view.$("a.unpublish").text()).toMatchTranslation("insight.unpublish.link");
            });

            context("when the unpublish link is clicked", function () {
                beforeEach(function () {
                    this.modalSpy = stubModals();
                    this.view.$("a.unpublish").click();
                });

                it("launches the confirmation alert", function () {
                    expect(this.modalSpy).toHaveModal(chorus.alerts.PublishInsight);
                });

                context("when the unpublish completes", function () {
                    beforeEach(function () {
                        this.view.model.unpublish();
                        this.server.lastCreate().succeed();
                    });

                    it("re-fetches the activity's collection", function () {
                        expect(this.collection).toHaveBeenFetched();
                    });
                });
            });
        });

        context("when it is unpublished", function () {
            it("should have a link to publish", function () {
                expect(this.view.$("a.publish")).toExist();
                expect(this.view.$("a.publish").text()).toMatchTranslation("insight.publish.link");
            });

            context("when the publish link is clicked", function () {
                beforeEach(function () {
                    this.modalSpy = stubModals();
                    this.view.$("a.publish").click();
                });

                it("launches the confirmation alert", function () {
                    expect(this.modalSpy).toHaveModal(chorus.alerts.PublishInsight);
                });

                context("when the publish completes", function () {
                    beforeEach(function () {
                        this.view.model.publish();
                        this.server.lastCreate().succeed();
                    });

                    it("re-fetches the activity's collection", function () {
                        expect(this.collection).toHaveBeenFetched();
                    });
                });
            });
        });
    }
});
