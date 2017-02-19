## 1-Click Tasks ##

1-Click Tasks is a Visual Studio Team Services extension to add tasks to User story or Bugs from predefined templates using a single click.

Download <a href="https://marketplace.visualstudio.com/items?itemName=ruifig.vsts-work-item-one-click-tasks" target="_blank">here</a>

Team Services allows you to create work item templates.
With work item templates you can quickly create work items which have pre-populated values for your team's commonly used fields.

1-Click Tasks uses predefined task templates and add them to a User Story or Bug using a single click.

### Setup your Task templates ###

Create your task templates

<img src="src/img/screen01.png" alt="Create your task templates" />


### Create / open a user Story/Bug ###

Find 1-Click Tasks on toolbar menu

<img src="src/img/screen02.png" alt="1-Click Tasks on the menu"/>

### Done ###

Now you have tasks associated with the User Story or Bug

<img src="src/img/screen03.png" alt="Done"/>

## Release notes ##

* v0.3.0
    
    Enforce correct order when adding child links to work item

* v0.4.0
    
    Identifier to distinguish templates sets to be added in a single click  <a href="https://github.com/figueiredorui/1-click-tasks/wiki/Group-templates-with-identifier" target="_blank">Wiki</a>

* v0.5.0 

    Add support for custom types

    1-Click-Task option available on Card and Backlog context menu.


## Usage ##

1. Clone the repository
1. `npm install` to install required local dependencies
2. `npm install -g grunt` to install a global copy of grunt (unless it's already installed)
2. `grunt` to build and package the application

### Grunt ###

Basic `grunt` tasks are defined:

* `package-dev` - Builds the development version of the vsix package
* `package-release` - Builds the release version of the vsix package
* `publish-dev` - Publishes the development version of the extension to the marketplace using `tfx-cli`
* `publish-release` - Publishes the release version of the extension to the marketplace using `tfx-cli`

Note: To avoid `tfx` prompting for your token when publishing, login in beforehand using `tfx login` and the service uri of ` https://marketplace.visualstudio.com`.

## Credits ##

Clone from https://github.com/cschleiden/vsts-extension-ts-seed-simple
