// Each route imports exactly one experience. Ordinary links unload its game,
// audio nodes and input handlers before the next game is started.
const route = location.pathname.replace(/\/+$/, '') || '/';
async function launch(): Promise<void> {
  if (route === '/blast-arena') {
    document.title = 'BLAST ARENA · Afterhours Arcade';
    await import('./blast');
  } else if (route === '/frontline-heroes') {
    document.title = 'FRONTLINE HEROES · Afterhours Arcade';
    await import('./frontline/main');
  } else {
    document.title = 'Afterhours Arcade · One more round.';
    await import('./arcade');
  }
}
void launch().catch(error => {
  const message=document.createElement('p');
  message.textContent=`The arcade could not load. Refresh the page to try again. ${error instanceof Error ? error.message : ''}`;
  document.querySelector('#app')?.replaceChildren(message);
});
export {};
