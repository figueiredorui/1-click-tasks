define(["TFS/WorkItemTracking/Services", "TFS/WorkItemTracking/RestClient", "TFS/Work/RestClient", "q", "VSS/Controls", "VSS/Controls/StatusIndicator", "VSS/Controls/Dialogs"],
    function (_WorkItemServices, _WorkItemRestClient, workRestClient, Q, Controls, StatusIndicator, Dialogs) {

        var ctx = null;

        function getWorkItemFormService() {
            return _WorkItemServices.WorkItemFormService.getService();
        }

        function getWorkItemFormNavigationService() {
            return _WorkItemServices.WorkItemFormNavigationService.getService();
        }

        function apiUrlBase() {

            var collection = ctx.collection.uri;
            var project = ctx.project.name;
            var team = ctx.team.name;
            var url = collection + project + '/' + team + '/_apis/wit';

            return url;
        }

        function getTemplates() {
            return VSS.getAccessToken()
                .then(function (response) {
                    var url = apiUrlBase() + '/templates?workItemTypeName=Task'
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

                    var url = apiUrlBase() + '/templates/' + id

                    return $.ajax({
                        url: url,
                        dataType: 'json',
                        headers: {
                            'Authorization': 'Basic ' + btoa("" + ":" + response.token)
                        }
                    })
                });
        }

        function IsPropertyValid(taskTemplate, key) {
            if (taskTemplate.fields.hasOwnProperty(key) == false) {
                return false;
            }
            if (key.indexOf('System.Tags') >= 0) { //not supporting tags for now
                return false;
            }
            if (taskTemplate.fields[key].toLowerCase() == '@me') { //not supporting current identity
                return false;
            }
            if (taskTemplate.fields[key].toLowerCase() == '@currentiteration') { //not supporting current iteration
                return false;
            }
            return true;
        }

        function createTask(witClient, service, WIT, taskTemplate, teamSettings) {

            var task = [];

            for (var key in taskTemplate.fields) {
                if (IsPropertyValid(taskTemplate, key)) {
                    task.push({ "op": "add", "path": "/fields/" + key, "value": taskTemplate.fields[key] })
                }
            }

            if (taskTemplate.fields['System.Title'] == null)
                task.push({ "op": "add", "path": "/fields/System.Title", "value": WIT['System.Title'] })

            if (taskTemplate.fields['System.AreaPath'] == null)
                task.push({ "op": "add", "path": "/fields/System.AreaPath", "value": WIT['System.AreaPath'] })

            if (taskTemplate.fields['System.IterationPath'] == null)
                task.push({ "op": "add", "path": "/fields/System.IterationPath", "value": WIT['System.IterationPath'] })
            else if (taskTemplate.fields['System.IterationPath'].toLowerCase() == '@currentiteration')
                task.push({ "op": "add", "path": "/fields/System.IterationPath", "value": teamSettings.backlogIteration.name + teamSettings.defaultIteration.path })

            if (taskTemplate.fields['System.AssignedTo'] == null) {
                if (WIT['System.AssignedTo'] != null)
                    task.push({ "op": "add", "path": "/fields/System.AssignedTo", "value": WIT['System.AssignedTo'] })
            }
            else if (taskTemplate.fields['System.AssignedTo'].toLowerCase() == '@me')
                task.push({ "op": "add", "path": "/fields/System.AssignedTo", "value": ctx.user.uniqueName })

            witClient.createWorkItem(task, VSS.getWebContext().project.name, 'Task')
                .then(function (response) {
                    //Add relation
                    if (service != null) {
                        service.addWorkItemRelations([
                            {
                                rel: "System.LinkTypes.Hierarchy-Forward",
                                url: response.url,
                            }]);
                        //Save 
                        service.beginSaveWorkItem(function (response) {
                            //WriteLog(" Saved");
                        }, function (error) {
                            ShowDialog(" Error saving: " + response);
                        });
                    }
                    else {
                        //save using RestClient
                        var workItemId = WIT['System.Id']
                        var document = [{
                            op: "add",
                            path: '/relations/-',
                            value: {
                                rel: "System.LinkTypes.Hierarchy-Forward",
                                url: response.url,
                                attributes: {
                                    isLocked: false,
                                }
                            }
                        }];

                        witClient.updateWorkItem(document, workItemId)
                            .then(function (response) {
                                var a = response;
                                VSS.getService(VSS.ServiceIds.Navigation).then(function (navigationService) {
                                    navigationService.reload();
                                });
                            });
                    }
                });
        }

        function hasChildTask(service) {
            return service.getWorkItemRelations().then(function (value) {
                // only add task if none
                var childs = value.find(function (v) { return v.rel == "System.LinkTypes.Hierarchy-Forward"; })
                if (childs) {
                    return;
                }
                return childs;
            });
        }

        function AddTasksOnForm(service) {

            var witClient = _WorkItemRestClient.getClient();
            var workClient = workRestClient.getClient();

            var team = {
                projectId: ctx.project.id,
                teamId: ctx.team.id
            }

            workClient.getTeamSettings(team)
                .then(function (teamSettings) {
                    // Get the current values for a few of the common fields
                    service.getFieldValues(["System.Id", "System.Title", "System.State", "System.CreatedDate", "System.IterationPath", "System.AreaPath", "System.AssignedTo", "System.RelatedLinkCount", "System.WorkItemType"])
                        .then(function (value) {
                            var WIT = value
                            // only create child task for Product Backlog Item and Bug
                            IsRequirementOrBugCategory(witClient, WIT)
                                .then(function (response) {
                                    if (response == true) {
                                        // get Templates
                                        getTemplates().then(function (response) {
                                            if (response.count == 0) {
                                                ShowDialog('Task Templates found: ' + response.count + '. Please add task templates to the Project Team.')
                                            }
                                            // created tasks alphabetical 
                                            var templates = response.value.sort(SortTemplates);
                                            var chain = Q.when();
                                            templates.forEach(function (template) {
                                                chain = chain.then(createTaskFromtemplate(witClient, service, WIT, template, teamSettings));
                                            });
                                            return chain;
                                        })
                                    }
                                    else {
                                        ShowDialog('Only creates child tasks for Product Backlog Items and Bugs.')
                                    }
                                })
                        })
                })
        }

        function AddTasksOnGrid(workItemId) {

            var witClient = _WorkItemRestClient.getClient();
            var workClient = workRestClient.getClient();

            var team = {
                projectId: ctx.project.id,
                teamId: ctx.team.id
            }

            workClient.getTeamSettings(team)
                .then(function (teamSettings) {
                    // Get the current values for a few of the common fields
                    witClient.getWorkItem(workItemId, ["System.Id", "System.Title", "System.State", "System.CreatedDate", "System.IterationPath", "System.AreaPath", "System.AssignedTo", "System.RelatedLinkCount", "System.WorkItemType"])
                        .then(function success(response) {
                            var WIT = response.fields
                            // only create child task for Product Backlog Item and Bug
                            IsRequirementOrBugCategory(witClient, WIT)
                                .then(function (response) {
                                    if (response == true) {
                                        // get Templates
                                        getTemplates().then(function (response) {
                                            if (response.count == 0) {
                                                ShowDialog('Task Templates found: ' + response.count + '. Please add task templates to the Project Team.')
                                            }
                                            // created tasks alphabetical 
                                            var templates = response.value.sort(SortTemplates);
                                            var chain = Q.when();
                                            templates.forEach(function (template) {
                                                chain = chain.then(createTaskFromtemplate(witClient, null, WIT, template, teamSettings));
                                            });
                                            return chain;

                                        })
                                    }
                                    else {
                                        ShowDialog('Only creates child tasks for Product Backlog Items and Bugs.')
                                    }
                                })
                        })
                })
        }

        function createTaskFromtemplate(witClient, service, WIT, template, teamSettings) {
            return function () {
                return getTemplate(template.id).then(function (taskTemplate) {
                    // Create child task
                    if (IsValidTemplate(WIT, taskTemplate)) {
                        createTask(witClient, service, WIT, taskTemplate, teamSettings)
                    }
                });;
            };
        }


        function IsValidTemplate(currentWorkItem, taskTemplate) {

            var filters = taskTemplate.description.match(/[^[\]]+(?=])/g)
            if (filters) {
                var isValid = false;
                for (var i = 0; i < filters.length; i++) {
                    isValid = filters[i].split(',').includes(currentWorkItem["System.WorkItemType"]);
                    if (isValid)
                        break;
                }
                return isValid;
            } else {
                return true;
            }
        }

        function IsRequirementOrBugCategory(witClient, WIT) {

            return witClient.getWorkItemTypeCategory(VSS.getWebContext().project.name, 'Microsoft.RequirementCategory')
                .then(function (response) {
                    var requirement = response.workItemTypes.find(function (workItemType) { return workItemType.name == WIT['System.WorkItemType']; });
                    if (requirement != null) {
                        return true;
                    }
                    else {
                        return witClient.getWorkItemTypeCategory(VSS.getWebContext().project.name, 'Microsoft.BugCategory')
                            .then(function (response) {
                                var requirement = response.workItemTypes.find(function (workItemType) { return workItemType.name == WIT['System.WorkItemType']; });
                                if (requirement != null) {
                                    return true;
                                }
                                else {
                                    return false;
                                }
                            });
                    }

                });
         
        }

        function WriteLog(msg) {
            console.log(msg);
        }

        function ShowDialog(message) {

            var dialogOptions = {
                title: "1-click task",
                width: 300,
                height: 200,
                resizable: false,
            };

            VSS.getService(VSS.ServiceIds.Dialog).then(function (dialogSvc) {

                dialogSvc.openMessageDialog(message, dialogOptions)
                    .then(function (dialog) {
                        //console.log('Ok');
                    }, function (dialog) {
                        //console.log('Cancel');
                    });
            });
        }

        function SortTemplates(a, b) {
            var nameA = a.name.toLowerCase(), nameB = b.name.toLowerCase();
            if (nameA < nameB) //sort string ascending
                return -1;
            if (nameA > nameB)
                return 1;
            return 0; //default return value (no sorting)
        };

        return {
            create: function (context) {
                console.log('init');
                ctx = VSS.getWebContext();
                /*
                var waitControlOptions = {
                    target: $("#container"),
                    message: "Saving...",
                    backgroundColor: "transparent"
                };
                var waitcontrol = Controls.create(StatusIndicator.WaitControl, $("#container"), waitControlOptions);
                waitcontrol.startWait();
                */
                getWorkItemFormService().then(function (service) {
                    service.hasActiveWorkItem()
                        .then(function success(response) {
                            if (response == true) {
                                //form is open
                                AddTasksOnForm(service);
                            }
                            else {
                                // on grid
                                var workItemId = 0
                                if (context.workItemIds && context.workItemIds.length > 0) {
                                    workItemId = context.workItemIds[0];
                                }
                                else if (context.id) {
                                    workItemId = context.id;
                                }

                                AddTasksOnGrid(workItemId);
                            }
                        });
                })
            },
        }
    });