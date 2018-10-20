import {chain, Rule, Tree, SchematicsException} from '@angular-devkit/schematics';
import {
  addModuleImportToRootModule,
  getProjectFromWorkspace,
  getProjectMainFile,
  getProjectTargetOptions,
  getSourceFile,
  hasNgModuleImport,
} from '@angular/cdk/schematics';
import {WorkspaceProject, WorkspaceSchema} from '@angular-devkit/core/src/workspace';
import {getWorkspace} from '@schematics/angular/utility/config';
import {addSymbolToNgModuleMetadata} from '@schematics/angular/utility/ast-utils';
import {getAppModulePath} from '@schematics/angular/utility/ng-ast-utils';
import {Schema} from './schema';
import { InsertChange } from '@schematics/angular/utility/change';

/** Name of the ngx-onsenui module. */
const onsenModuleName = 'OnsenModule';

/**
 * Scaffolds the basics of a Angular Material application, this includes:
 *  - Add Packages to package.json
 *  - Adds pre-built themes to styles.ext
 *  - Adds OnsenModule to app.module
 */
export default function(options: Schema): Rule {
  return chain([
    addOnsenModule(options),
    addCustomElementsSchema(options),
    addOnsenStyles(options),
  ]);
}

/**
 * Adds an animation module to the root module of the specified project.
 */
function addOnsenModule(options: Schema) {
  return (host: Tree) => {
    const workspace = getWorkspace(host);
    const project = getProjectFromWorkspace(workspace, options.project);
    const appModulePath = getAppModulePath(host, getProjectMainFile(project));

    if (!hasNgModuleImport(host, appModulePath, onsenModuleName)) {
      // Do not add the OnsenModule module if the project already explicitly uses
      // the BrowserAnimationsModule.
      addModuleImportToRootModule(host, onsenModuleName, 'ngx-onsenui', project);
    }

    return host;
  };
}

/**
 * Adds CUSTOM_ELEMENTS_SCHEMA to the root module of the specified project. 
 */
function addCustomElementsSchema(options: Schema) {
  return (host: Tree) => {
    const workspace = getWorkspace(host);
    const project = getProjectFromWorkspace(workspace, options.project);
    const appModulePath = getAppModulePath(host, getProjectMainFile(project));

    const moduleSource = getSourceFile(host, appModulePath);
    if (!moduleSource) {
        throw new SchematicsException(`Module not found: ${appModulePath}`);
    }

    const changes = addSymbolToNgModuleMetadata(moduleSource, appModulePath, 'schemas', 'CUSTOM_ELEMENTS_SCHEMA', '@angular/core');

    const declarationRecorder = host.beginUpdate(appModulePath);
    for (const change of changes) {
      if (change instanceof InsertChange) {
        declarationRecorder.insertLeft(change.pos, change.toAdd);
      }
    }
    host.commitUpdate(declarationRecorder);

    return host;
  }
}

/**
 * Adds Onsen UI styles to the specified project. 
 */
function addOnsenStyles(options: Schema) {
  return (host: Tree) => {
    const workspace = getWorkspace(host);
    const project = getProjectFromWorkspace(workspace, options.project);
    const onsenTheme =  `./node_modules/onsenui/css/onsenui.css`;
    const onsenComponentsTheme =  `./node_modules/onsenui/css/onsen-css-components.css`;

    addThemeStyleToTarget(project, 'build', host, onsenTheme, workspace);
    addThemeStyleToTarget(project, 'build', host, onsenComponentsTheme, workspace);
    addThemeStyleToTarget(project, 'test', host, onsenTheme, workspace);
    addThemeStyleToTarget(project, 'test', host, onsenComponentsTheme, workspace);

    return host;
  };
}

/** Adds a theming style entry to the given project target options. */
function addThemeStyleToTarget(project: WorkspaceProject, targetName: string, host: Tree,
  assetPath: string, workspace: WorkspaceSchema) {

  const targetOptions = getProjectTargetOptions(project, targetName);

  if (!targetOptions.styles) {
    targetOptions.styles = [assetPath];
  } else {
    const existingStyles = targetOptions.styles.map((s: any) => typeof s === 'string' ? s : s.input);

    for (let stylePath of existingStyles.entries()) {
      // If the given asset is already specified in the styles, we don't need to do anything.
      if (stylePath === assetPath) {
        return;
      }
    }

    targetOptions.styles.unshift(assetPath);
  }

  host.overwrite('angular.json', JSON.stringify(workspace, null, 2));
}