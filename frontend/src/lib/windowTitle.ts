/** The browser tab title: the app name, plus the open project's folder path when there is one */
export function windowTitle(projectPath: string | undefined): string {
  return projectPath ? `Pimika — ${projectPath}` : 'Pimika'
}
