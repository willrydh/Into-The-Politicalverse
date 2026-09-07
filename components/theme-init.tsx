// Apply before the first paint, including full reloads and language changes.
// This fixed script contains no external or user-provided content.
export function ThemeInit() {
  return <script dangerouslySetInnerHTML={{ __html: `(function(){var t;try{t=localStorage.getItem('politicalverse-theme')}catch(e){}document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()` }} />;
}
