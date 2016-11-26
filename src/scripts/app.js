define(["TFS/WorkItemTracking/Services", "TFS/WorkItemTracking/RestClient", "q", "VSS/Controls", "VSS/Controls/StatusIndicator"], function (_WorkItemServices, _WorkItemRestClient, Q, Controls, StatusIndicator) {

    function getWorkItemFormService() {
        return _WorkItemServices.WorkItemFormService.getService();
    }

    function getWorkItemFormNavigationService() {
        return _WorkItemServices.WorkItemFormNavigationService.getService();
    }

    function getTemplates() {
        return VSS.getAccessToken()
            .then(function (response) {

                var ctx = VSS.getWebContext();
                var collection = ctx.collection.uri;
                var project = ctx.project.name;
                var team = ctx.team.name;

                var url = collection + project + '/' + team + '/_apis/wit/templates?workItemTypeName=Task'

                return $.ajax({
                    url: url,
                    dataType: 'json',
                    headers: {
                        'Authorization': 'Basic ' + btoa("" + ":" + response.token)
                    }
                })
            });
    }

    function getTemplate(id) {
        return VSS.getAccessToken()
            .then(function (response) {

                var ctx = VSS.getWebContext();
                var collection = ctx.collection.uri;
                var project = ctx.project.name;
                var team = ctx.team.name;

                var url = collection + project + '/' + team + '/_apis/wit/templates/' + id

                return $.ajax({
                    url: url,
                    dataType: 'json',
                    headers: {
                        'Authorization': 'Basic ' + btoa("" + ":" + response.token)
                    }
                })
            });
    }


    function createTask(witClient, service, WIT, taskTemplate) {

        var title = taskTemplate.fields['System.Title'];
        if (title.indexOf('[ParentTitle]') > -1) {
            title = "Task for " + WIT['System.Title']
        }

        var assignedTo = taskTemplate.fields['System.AssignedTo'];
        if (assignedTo == null)
            assignedTo = WIT['System.AssignedTo'];

        witClient.createWorkItem([{
            "op": "add",
            "path": "/fields/System.Title",
            "value": title
        }, {
            "op": "add",
            "path": "/fields/System.IterationPath",
            "value": WIT['System.IterationPath']
        }, {
            "op": "add",
            "path": "/fields/System.AssignedTo",
            "value": assignedTo
        },
        {
            "op": "add",
            "path": "/fields/Microsoft.VSTS.Common.Activity",
            "value": taskTemplate.fields['Microsoft.VSTS.Common.Activity']
        },
        {
            "op": "add",
            "path": "/fields/Microsoft.VSTS.Scheduling.RemainingWork",
            "value": taskTemplate.fields['Microsoft.VSTS.Scheduling.RemainingWork']
        }

        ], VSS.getWebContext().project.name, 'Task')
            .then(function (response) {
                //Add relation
                service.addWorkItemRelations([
                    {
                        rel: "System.LinkTypes.Hierarchy-Forward",
                        url: response.url,
                    }]);
                //Save 
                service.beginSaveWorkItem(function (response) {
                    WriteLog(" Saved");
                }, function (error) {
                    WriteLog(" Error saving");
                });
            });
    }

    function hasChildTask(service) {
        return service.getWorkItemRelations().then(function (value) {
            // only add task if none
            var childs = value.find(function (v) { return v.rel == "System.LinkTypes.Hierarchy-Forward"; })
            if (childs) {
                WriteLog(" Already has child tasks");
                return;
            }
            return childs;
        });
    }

    function AddTasks(service) {

        var witClient = _WorkItemRestClient.getClient();

        hasChildTask(service).then(function (value) {
            var waitcontrol = startWaitControl();
            // Get the current values for a few of the common fields
            service.getFieldValues(["System.Id", "System.Title", "System.State", "System.CreatedDate", "System.IterationPath", "System.AssignedTo", "System.RelatedLinkCount", "System.WorkItemType"]).then(
                function (value) {
                    var WIT = value
                    // only create child task for Product Backlog Item and Bug
                    if (WIT['System.WorkItemType'] == 'Product Backlog Item' || WIT['System.WorkItemType'] == 'Bug') {

                        // get Templates
                        getTemplates().then(function (response) {
                            WriteLog('Templates: ' + response.count)
                            // Create child task
                            response.value.forEach(function (template) {

                                getTemplate(template.id).then(function (taskTemplate) {

                                    createTask(witClient, service, WIT, taskTemplate)
                                    endWaitControl(waitcontrol);
                                });
                            }, this);
                            

                        })
                    }
                    else {
                        WriteLog('only create child task for Product Backlog Item and Bug')
                    }
                    //endWaitControl(waitcontrol);
                })

        })
    }

    function WriteLog(msg) {
       // console.log(msg);
    }

    function startWaitControl() {
        var isAlreadyRunning = $("#waitcontrol").attr("running") === "true";
        if (isAlreadyRunning) {
            return null;
        }
        else {
            var waitControlOptions = {
                //target: $(".section-container"),
                message: "loading...",
                // backgroundColor: "transparent"
            };
            var waitcontrol = Controls.create(StatusIndicator.WaitControl, $(".section-container"), waitControlOptions);
            waitcontrol.startWait();
            WriteLog('waitcontrol.startWait()')
            $("#waitcontrol").attr("running", "true");
            return waitcontrol;
        }
    }
    function endWaitControl(waitcontrol) {
        if (waitcontrol) {
            waitcontrol.endWait();
            WriteLog('waitcontrol.endWait()')
            $("#waitcontrol").attr("running", "false");
        }
    }

    return {

        create: function (context) {
            getWorkItemFormService().then(function (service) {
                AddTasks(service)
            })
        },

    }
});