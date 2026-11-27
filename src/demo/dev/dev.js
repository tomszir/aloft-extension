// The host page's side of the demo, as the site does it: nothing loads until
// "Try Aloft" is pressed.
const host = document.getElementById('aloft-demo')
const note = document.getElementById('note')
const install = document.getElementById('install')
const tryButton = document.getElementById('try')
const schemeButton = document.getElementById('scheme')

let scheme = 'dark'
let demo

tryButton.addEventListener('click', async () => {
  if (!demo) {
    const { mountDemo } = await import('/aloft-demo.js')
    demo = mountDemo(host, {
      scheme,
      tour: true,
      onWould: (what) => {
        note.textContent = what
      },
      onClose: () => {
        note.textContent = ''
      },
      onFinish: () => {
        install.hidden = false
      },
    })
  }
  demo.open()
})

schemeButton.addEventListener('click', () => {
  scheme = scheme === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.scheme = scheme
  schemeButton.textContent = `Switch page to ${scheme === 'dark' ? 'light' : 'dark'}`
  demo?.setScheme(scheme)
})
