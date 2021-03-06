chorus.dialogs.AssociateMultipleWithWorkspace = chorus.dialogs.PickWorkspace.extend({
    constructorName: "AssociateWithWorkspace",

    title: t("dataset.associate.title.other"),
    submitButtonTranslationKey: "dataset.associate.button.other",

    setup: function(options) {
        this.datasets = options.datasets;
        this.requiredResources.add(this.collection);
        this._super('setup', arguments);
    },

    submit: function() {
        this.$("button.submit").startLoading("actions.associating");

        var workspace = this.selectedItem();
        var datasetSet = workspace.datasets();
        datasetSet.reset(this.datasets.models);

        this.bindings.add(datasetSet, "saved", this.saved);
        datasetSet.save();
    },

    saved: function() {
        this.datasets.each(function(dataset) { dataset.fetch(); });
        chorus.toast("dataset.associate.toast.other", {
            workspaceNameTarget: this.selectedItem().get("name"),
            count: this.datasets.length
        });
        this.closeModal();
    }
});
