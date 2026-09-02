export async function installSyntheticVisibleSpinners(page, count, animation, steps) {
  if (count <= 0) {
    return
  }
  const animationTiming =
    animation === 'steps' ? `1s steps(${steps}, end) infinite` : '1s linear infinite'
  await page.addStyleTag({
    content: `
      @keyframes aio-ade-idle-bench-spin {
        to { transform: rotate(360deg); }
      }
      .aio-ade-idle-bench-spinner-host {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      .aio-ade-idle-bench-spinner {
        width: 10px;
        height: 10px;
        border: 2px solid rgb(234 179 8);
        border-top-color: transparent;
        border-radius: 9999px;
        animation: aio-ade-idle-bench-spin ${animationTiming};
      }
    `
  })
  await page.evaluate((spinnerCount) => {
    document.querySelector('[data-aio-ade-idle-bench-spinners]')?.remove()
    const host = document.createElement('div')
    host.className = 'aio-ade-idle-bench-spinner-host'
    host.setAttribute('data-aio-ade-idle-bench-spinners', String(spinnerCount))
    for (let index = 0; index < spinnerCount; index += 1) {
      const spinner = document.createElement('div')
      spinner.className = 'aio-ade-idle-bench-spinner'
      host.appendChild(spinner)
    }
    document.body.appendChild(host)
  }, count)
}
