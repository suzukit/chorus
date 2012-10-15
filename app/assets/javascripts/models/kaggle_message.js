chorus.models.KaggleMessage = chorus.models.Base.extend({
    urlTemplate: "workspaces/{{workspace.id}}/kaggle/messages",

    paramsToSave: ['from', 'subject', 'message', 'recipient_ids'],

    declareValidations: function(newAttrs) {
        this.requireValidEmailAddress('from', newAttrs);
        this.require('subject', newAttrs);
        this.require('message', newAttrs);
    },

    recipient_ids: function() {
        return [this.get('recipient').get('id')];
    }
});