let audioFiles = []
const radioStations = []
let currentTrackIndex = -1
let isPlaying = false
let isShuffleEnabled = localStorage.getItem("shuffleEnabled") === "true"
let shuffledIndices = []

const audioPlayer = document.getElementById("audioPlayer")
const fileInput = document.getElementById("fileInput")
const fileList = document.getElementById("fileList")
const playPauseBtn = document.getElementById("playPauseBtn")
const prevBtn = document.getElementById("prevBtn")
const nextBtn = document.getElementById("nextBtn")
const progressBar = document.getElementById("progressBar")
const progressFill = document.getElementById("progressFill")
const currentTimeEl = document.getElementById("currentTime")
const durationEl = document.getElementById("duration")
const trackNameEl = document.getElementById("trackName")
const volumeSlider = document.getElementById("volumeSlider")
const albumArt = document.getElementById("albumArt")
const noAudioMessage = document.getElementById("noAudioMessage")
const removeFileBtn = document.getElementById("removeFileBtn")
const addRadioBtn = document.getElementById("addRadioBtn")
const radioModal = document.getElementById("radioModal")
const radioForm = document.getElementById("radioForm")
const cancelRadioBtn = document.getElementById("cancelRadioBtn")
const radioNameInput = document.getElementById("radioName")
const radioUrlInput = document.getElementById("radioUrl")
const stylesBtn = document.getElementById("stylesBtn")
const stylesModal = document.getElementById("stylesModal")
const closeStylesBtn = document.getElementById("closeStylesBtn")
const eqResetBtn = document.getElementById("eqResetBtn")
const shuffleBtn = document.getElementById("shuffleBtn")
const exportEqBtn = document.getElementById("exportEqBtn")
const importEqBtn = document.getElementById("importEqBtn")
const importEqInput = document.getElementById("importEqInput")
const fullscreenBtn = document.getElementById("fullscreenBtn")
const styleOptions = document.querySelectorAll(".style-option")
const plusBtn = document.getElementById("plusBtn")
const eqToggleBtn = document.getElementById("eqToggleBtn")
const equalizerWindow = document.querySelector(".equalizer")

let audioContext
let analyser
let source
let gainNode
const eqFilters = []
let currentVisualizerStyle = localStorage.getItem("visualizerStyle") || "spectrum"

const canvas = document.getElementById("spectrum-canvas")
const canvasCtx = canvas.getContext("2d")

let jsmediatags

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256

    gainNode = audioContext.createGain()

    const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]
    frequencies.forEach((freq) => {
      const filter = audioContext.createBiquadFilter()
      filter.type = "peaking"
      filter.frequency.value = freq
      filter.Q.value = 1
      filter.gain.value = 0
      eqFilters.push(filter)
    })

    audioPlayer.crossOrigin = "anonymous"

    source = audioContext.createMediaElementSource(audioPlayer)

    let currentNode = source
    eqFilters.forEach((filter) => {
      currentNode.connect(filter)
      currentNode = filter
    })
    currentNode.connect(gainNode)
    gainNode.connect(analyser)
    analyser.connect(audioContext.destination)

    initEqualizer()

    visualize()
  }
}

function initEqualizer() {
  const equalizerContent = document.getElementById("equalizerContent")
  const frequencies = ["60Hz", "170Hz", "310Hz", "600Hz", "1kHz", "3kHz", "6kHz", "12kHz", "14kHz", "16kHz"]

  equalizerContent.innerHTML = ""

  frequencies.forEach((freq, index) => {
    const band = document.createElement("div")
    band.className = "eq-band"

    const label = document.createElement("div")
    label.className = "eq-label"
    label.textContent = freq

    const slider = document.createElement("input")
    slider.type = "range"
    slider.className = "eq-slider"
    slider.min = "-12"
    slider.max = "12"
    slider.value = "0"
    slider.step = "1"
    slider.dataset.index = index

    const value = document.createElement("div")
    value.className = "eq-value"
    value.textContent = "0dB"

    slider.addEventListener("input", (e) => {
      const gain = Number.parseFloat(e.target.value)
      eqFilters[index].gain.value = gain
      value.textContent = gain > 0 ? `+${gain}dB` : `${gain}dB`
    })

    band.appendChild(label)
    band.appendChild(slider)
    band.appendChild(value)
    equalizerContent.appendChild(band)
  })
}

eqResetBtn.addEventListener("click", () => {
  const sliders = document.querySelectorAll(".eq-slider")
  const values = document.querySelectorAll(".eq-value")

  sliders.forEach((slider, index) => {
    slider.value = "0"
    eqFilters[index].gain.value = 0
    values[index].textContent = "0dB"
  })
})

if (isShuffleEnabled) {
  shuffleBtn.classList.add("active")
}

shuffleBtn.addEventListener("click", () => {
  isShuffleEnabled = !isShuffleEnabled
  localStorage.setItem("shuffleEnabled", isShuffleEnabled.toString())

  if (isShuffleEnabled) {
    shuffleBtn.classList.add("active")
    generateShuffledIndices()
  } else {
    shuffleBtn.classList.remove("active")
    shuffledIndices = []
  }
})

function generateShuffledIndices() {
  const totalTracks = audioFiles.length + radioStations.length
  shuffledIndices = Array.from({ length: totalTracks }, (_, i) => i)

  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]]
  }
}

exportEqBtn.addEventListener("click", () => {
  const eqConfig = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    filters: eqFilters.map((filter, index) => ({
      frequency: filter.frequency.value,
      gain: filter.gain.value,
      index: index,
    })),
  }

  const dataStr = JSON.stringify(eqConfig, null, 2)
  const dataBlob = new Blob([dataStr], { type: "application/json" })
  const url = URL.createObjectURL(dataBlob)

  const link = document.createElement("a")
  link.href = url
  link.download = `eq-config-${Date.now()}.json`
  link.click()

  URL.revokeObjectURL(url)
})

importEqBtn.addEventListener("click", () => {
  importEqInput.click()
})

importEqInput.addEventListener("change", (e) => {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const eqConfig = JSON.parse(event.target.result)

      if (!eqConfig.filters || !Array.isArray(eqConfig.filters)) {
        alert("Invalid EQ configuration file")
        return
      }

      const sliders = document.querySelectorAll(".eq-slider")
      const values = document.querySelectorAll(".eq-value")

      eqConfig.filters.forEach((filterConfig) => {
        const index = filterConfig.index
        if (index >= 0 && index < eqFilters.length && sliders[index] && values[index]) {
          eqFilters[index].gain.value = filterConfig.gain
          sliders[index].value = filterConfig.gain
          const gain = filterConfig.gain
          values[index].textContent = gain > 0 ? `+${gain}dB` : `${gain}dB`
        }
      })
    } catch (error) {
      alert("Error reading EQ configuration file")
      console.error(error)
    }
  }

  reader.readAsText(file)
  importEqInput.value = ""
})

fileInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files)
  audioFiles = files.filter((file) => file.type.startsWith("audio/"))

  if (audioFiles.length > 0) {
    if (isShuffleEnabled) {
      generateShuffledIndices()
    }
    renderFileList()
    loadTrack(0)
  }
})

removeFileBtn.addEventListener("click", () => {
  if (currentTrackIndex === -1) return

  const isRadio = currentTrackIndex >= audioFiles.length

  if (isRadio) {
    const radioIndex = currentTrackIndex - audioFiles.length
    radioStations.splice(radioIndex, 1)
  } else {
    audioFiles.splice(currentTrackIndex, 1)
  }

  if (audioFiles.length === 0 && radioStations.length === 0) {
    currentTrackIndex = -1
    audioPlayer.pause()
    audioPlayer.src = ""
    trackNameEl.textContent = "NO TRACK LOADED"
    albumArt.innerHTML = "♪"
    playPauseBtn.disabled = true
    prevBtn.disabled = true
    nextBtn.disabled = true
    isPlaying = false
    playPauseBtn.textContent = "►"
  } else {
    if (currentTrackIndex >= audioFiles.length + radioStations.length) {
      currentTrackIndex = audioFiles.length + radioStations.length - 1
    }
    loadTrack(currentTrackIndex)
  }

  renderFileList()
})

addRadioBtn.addEventListener("click", () => {
  radioModal.classList.add("active")
  radioNameInput.focus()
})

cancelRadioBtn.addEventListener("click", () => {
  radioModal.classList.remove("active")
  radioForm.reset()
})

radioForm.addEventListener("submit", (e) => {
  e.preventDefault()
  const name = radioNameInput.value.trim()
  const url = radioUrlInput.value.trim()

  if (name && url) {
    radioStations.push({ name, url })
    renderFileList()
    radioModal.classList.remove("active")
    radioForm.reset()

    if (currentTrackIndex === -1) {
      loadTrack(audioFiles.length)
    }
  }
})

radioModal.addEventListener("click", (e) => {
  if (e.target === radioModal) {
    radioModal.classList.remove("active")
    radioForm.reset()
  }
})

stylesBtn.addEventListener("click", () => {
  stylesModal.classList.add("active")
  updateActiveStyle()
})

closeStylesBtn.addEventListener("click", () => {
  stylesModal.classList.remove("active")
})

stylesModal.addEventListener("click", (e) => {
  if (e.target === stylesModal) {
    stylesModal.classList.remove("active")
  }
})

document.querySelectorAll(".style-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentVisualizerStyle = btn.dataset.style
    localStorage.setItem("visualizerStyle", currentVisualizerStyle)
    updateActiveStyle()
  })
})

function updateActiveStyle() {
  document.querySelectorAll(".style-option").forEach((btn) => {
    if (btn.dataset.style === currentVisualizerStyle) {
      btn.classList.add("active")
    } else {
      btn.classList.remove("active")
    }
  })
}

function renderFileList() {
  fileList.innerHTML = ""

  if (audioFiles.length > 0) {
    const filesHeader = document.createElement("div")
    filesHeader.className = "category-header"
    filesHeader.textContent = "▼ AUDIO FILES"
    fileList.appendChild(filesHeader)

    audioFiles.forEach((file, index) => {
      const fileItem = document.createElement("div")
      fileItem.className = "file-item"
      fileItem.textContent = file.name
      fileItem.addEventListener("click", () => {
        loadTrack(index)
      })
      fileList.appendChild(fileItem)
    })
  }

  if (radioStations.length > 0) {
    const radiosHeader = document.createElement("div")
    radiosHeader.className = "category-header"
    radiosHeader.textContent = "▼ RADIO STATIONS"
    fileList.appendChild(radiosHeader)

    radioStations.forEach((radio, index) => {
      const fileItem = document.createElement("div")
      fileItem.className = "file-item radio"
      fileItem.textContent = radio.name
      fileItem.addEventListener("click", () => {
        loadTrack(audioFiles.length + index)
      })
      fileList.appendChild(fileItem)
    })
  }

  updateActiveFile()
}

function loadTrack(index) {
  const totalTracks = audioFiles.length + radioStations.length
  if (index < 0 || index >= totalTracks) return

  currentTrackIndex = index
  const isRadio = index >= audioFiles.length

  progressFill.style.width = "0%"
  currentTimeEl.textContent = "00:00"

  if (isRadio) {
    const radioIndex = index - audioFiles.length
    const radio = radioStations[radioIndex]
    audioPlayer.src = radio.url
    trackNameEl.textContent = radio.name
    albumArt.innerHTML = `
      <div class="vinyl-record"></div>
    `
  } else {
    const file = audioFiles[index]
    const url = URL.createObjectURL(file)
    audioPlayer.src = url
    trackNameEl.textContent = file.name
    extractAlbumArt(file)
  }

  playPauseBtn.disabled = false
  prevBtn.disabled = index === 0
  nextBtn.disabled = index === totalTracks - 1

  updateActiveFile()

  if (!audioContext) {
    initAudioContext()
  }

  if (isPlaying) {
    audioPlayer.play()
  }
}

async function extractAlbumArt(file) {
  const albumArtEl = document.getElementById("albumArt")
  albumArtEl.innerHTML = `
    <div class="vinyl-record"></div>
  `
  albumArtEl.classList.remove("spinning")

  if (typeof window.jsmediatags === "undefined") {
    return
  }

  window.jsmediatags.read(file, {
    onSuccess: (tag) => {
      const { tags } = tag
      if (tags.picture) {
        const { data, format } = tags.picture
        let base64String = ""
        for (let i = 0; i < data.length; i++) {
          base64String += String.fromCharCode(data[i])
        }
        const imageUrl = `data:${format};base64,${window.btoa(base64String)}`

        albumArtEl.innerHTML = `
          <div class="vinyl-record">
            <div class="vinyl-label">
              <img src="${imageUrl}" alt="Album Art">
            </div>
          </div>
        `

        if (isPlaying) {
          albumArtEl.classList.add("spinning")
        }
      }
    },
    onError: (error) => {
      console.log("Error reading tags:", error)
    },
  })
}

playPauseBtn.addEventListener("click", () => {
  if (!audioContext) {
    initAudioContext()
  }

  if (audioContext.state === "suspended") {
    audioContext.resume()
  }

  const albumArtEl = document.getElementById("albumArt")

  if (isPlaying) {
    audioPlayer.pause()
    playPauseBtn.textContent = "►"
    isPlaying = false
    albumArtEl.classList.remove("spinning")
  } else {
    audioPlayer.play()
    playPauseBtn.textContent = "⏸"
    isPlaying = true
    noAudioMessage.style.display = "none"
    albumArtEl.classList.add("spinning")
  }
})

prevBtn.addEventListener("click", () => {
  const isCurrentRadio = currentTrackIndex >= audioFiles.length
  let prevIndex = -1

  if (isShuffleEnabled) {
    if (shuffledIndices.length === 0) {
      generateShuffledIndices()
    }

    const currentShufflePos = shuffledIndices.indexOf(currentTrackIndex)

    for (let i = currentShufflePos - 1; i >= 0; i--) {
      const candidateIndex = shuffledIndices[i]
      const candidateIsRadio = candidateIndex >= audioFiles.length

      if (candidateIsRadio === isCurrentRadio) {
        prevIndex = candidateIndex
        break
      }
    }
  } else {
    if (isCurrentRadio) {
      const radioIndex = currentTrackIndex - audioFiles.length
      if (radioIndex > 0) {
        prevIndex = currentTrackIndex - 1
      }
    } else {
      if (currentTrackIndex > 0) {
        prevIndex = currentTrackIndex - 1
      }
    }
  }

  if (prevIndex >= 0) {
    loadTrack(prevIndex)
    if (isPlaying) {
      audioPlayer.play()
    }
  }
})

nextBtn.addEventListener("click", () => {
  const isCurrentRadio = currentTrackIndex >= audioFiles.length
  let nextIndex = -1

  if (isShuffleEnabled) {
    if (shuffledIndices.length === 0) {
      generateShuffledIndices()
    }

    const currentShufflePos = shuffledIndices.indexOf(currentTrackIndex)

    for (let i = currentShufflePos + 1; i < shuffledIndices.length; i++) {
      const candidateIndex = shuffledIndices[i]
      const candidateIsRadio = candidateIndex >= audioFiles.length

      if (candidateIsRadio === isCurrentRadio) {
        nextIndex = candidateIndex
        break
      }
    }
  } else {
    if (isCurrentRadio) {
      const radioIndex = currentTrackIndex - audioFiles.length
      if (radioIndex < radioStations.length - 1) {
        nextIndex = currentTrackIndex + 1
      }
    } else {
      if (currentTrackIndex < audioFiles.length - 1) {
        nextIndex = currentTrackIndex + 1
      }
    }
  }

  const albumArtEl = document.getElementById("albumArt")

  if (nextIndex >= 0) {
    loadTrack(nextIndex)
    if (isPlaying) {
      audioPlayer.play()
    }
  } else {
    playPauseBtn.textContent = "►"
    isPlaying = false
    albumArtEl.classList.remove("spinning")
  }
})

audioPlayer.addEventListener("ended", () => {
  const isCurrentRadio = currentTrackIndex >= audioFiles.length
  let nextIndex = -1

  if (isShuffleEnabled) {
    if (shuffledIndices.length === 0) {
      generateShuffledIndices()
    }

    const currentShufflePos = shuffledIndices.indexOf(currentTrackIndex)

    for (let i = currentShufflePos + 1; i < shuffledIndices.length; i++) {
      const candidateIndex = shuffledIndices[i]
      const candidateIsRadio = candidateIndex >= audioFiles.length

      if (candidateIsRadio === isCurrentRadio) {
        nextIndex = candidateIndex
        break
      }
    }
  } else {
    if (isCurrentRadio) {
      const radioIndex = currentTrackIndex - audioFiles.length
      if (radioIndex < radioStations.length - 1) {
        nextIndex = currentTrackIndex + 1
      }
    } else {
      if (currentTrackIndex < audioFiles.length - 1) {
        nextIndex = currentTrackIndex + 1
      }
    }
  }

  const albumArtEl = document.getElementById("albumArt")

  if (nextIndex >= 0) {
    loadTrack(nextIndex)
    audioPlayer.play()
  } else {
    playPauseBtn.textContent = "►"
    isPlaying = false
    albumArtEl.classList.remove("spinning")
  }
})

let isDraggingProgress = false

progressBar.addEventListener("mousedown", (e) => {
  isDraggingProgress = true
  updateProgressFromMouse(e)
})

document.addEventListener("mousemove", (e) => {
  if (isDraggingProgress) {
    updateProgressFromMouse(e)
  }
})

document.addEventListener("mouseup", () => {
  if (isDraggingProgress) {
    isDraggingProgress = false
  }
})

function updateProgressFromMouse(e) {
  const rect = progressBar.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))

  progressFill.style.width = `${percent * 100}%`

  if (!isNaN(audioPlayer.duration)) {
    audioPlayer.currentTime = percent * audioPlayer.duration
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime)
  }
}

// progressBar.addEventListener("click", (e) => {
//   const rect = progressBar.getBoundingClientRect()
//   const percent = (e.clientX - rect.left) / rect.width
//   audioPlayer.currentTime = percent * audioPlayer.duration
// })

audioPlayer.addEventListener("timeupdate", () => {
  const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100
  progressFill.style.width = `${progress}%`

  currentTimeEl.textContent = formatTime(audioPlayer.currentTime)
})

audioPlayer.addEventListener("loadedmetadata", () => {
  durationEl.textContent = formatTime(audioPlayer.duration)
})

volumeSlider.addEventListener("input", (e) => {
  const volume = e.target.value / 100
  audioPlayer.volume = volume

  if (gainNode) {
    gainNode.gain.value = volume
  }
})

audioPlayer.volume = 0.7

function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

let vinylRotation = 0
let lastFrameTime = null

const spectrogramHistory = []
const maxHistoryLength = 120

function visualize() {
  requestAnimationFrame(visualize)

  if (isPlaying) {
    const currentTime = performance.now()

    if (lastFrameTime === null) {
      lastFrameTime = currentTime
    }

    const deltaTime = (currentTime - lastFrameTime) / 1000
    lastFrameTime = currentTime

    vinylRotation += 200 * deltaTime
    if (vinylRotation >= 360) vinylRotation -= 360

    const vinylRecord = document.querySelector(".vinyl-record")
    if (vinylRecord) {
      vinylRecord.style.transform = `rotate(${vinylRotation}deg)`
    }
  } else {
    lastFrameTime = null
  }

  if (!analyser) return

  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  if (currentVisualizerStyle === "wave") {
    analyser.getByteTimeDomainData(dataArray)
  } else {
    analyser.getByteFrequencyData(dataArray)
  }

  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight

  const WIDTH = canvas.width
  const HEIGHT = canvas.height

  canvasCtx.fillStyle = "#0a0014"
  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)

  switch (currentVisualizerStyle) {
    case "spectrum":
      drawSpectrum(dataArray, bufferLength, WIDTH, HEIGHT)
      break
    case "mirror":
      drawMirror(dataArray, bufferLength, WIDTH, HEIGHT)
      break
    case "wave":
      drawWaveform(dataArray, bufferLength, WIDTH, HEIGHT)
      break
    case "galaxy":
      drawDialUpWaves(dataArray, bufferLength, WIDTH, HEIGHT)
      break
    case "retro":
      drawRetro3D(dataArray, bufferLength, WIDTH, HEIGHT)
      break
    case "dialup":
      drawDialUpSpectrum(dataArray, bufferLength, WIDTH, HEIGHT)
      break
  }
}

function drawSpectrum(dataArray, bufferLength, WIDTH, HEIGHT) {
  const barWidth = (WIDTH / bufferLength) * 2.5
  let x = 0

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * HEIGHT * 0.8

    const gradient = canvasCtx.createLinearGradient(0, HEIGHT - barHeight, 0, HEIGHT)
    gradient.addColorStop(0, "#ff00ff")
    gradient.addColorStop(0.5, "#ff0080")
    gradient.addColorStop(1, "#8000ff")

    canvasCtx.fillStyle = gradient
    canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth - 2, barHeight)

    if (barHeight > 10) {
      canvasCtx.fillStyle = "#00ffff"
      canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth - 2, 4)
    }

    x += barWidth + 1
  }

  drawGrid(WIDTH, HEIGHT)
}

function drawMirror(dataArray, bufferLength, WIDTH, HEIGHT) {
  const barWidth = (WIDTH / bufferLength) * 2.5
  let x = 0

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * (HEIGHT / 2) * 0.8

    const gradient = canvasCtx.createLinearGradient(0, HEIGHT / 2 - barHeight, 0, HEIGHT / 2)
    gradient.addColorStop(0, "#ff00ff")
    gradient.addColorStop(0.5, "#ff0080")
    gradient.addColorStop(1, "#8000ff")

    canvasCtx.fillStyle = gradient
    canvasCtx.fillRect(x, HEIGHT / 2 - barHeight, barWidth - 2, barHeight)

    if (barHeight > 10) {
      canvasCtx.fillStyle = "#00ffff"
      canvasCtx.fillRect(x, HEIGHT / 2 - barHeight, barWidth - 2, 3)
    }

    x += barWidth + 1
  }

  x = 0
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * (HEIGHT / 2) * 0.8

    const gradient = canvasCtx.createLinearGradient(0, HEIGHT / 2, 0, HEIGHT / 2 + barHeight)
    gradient.addColorStop(0, "#8000ff")
    gradient.addColorStop(0.5, "#ff0080")
    gradient.addColorStop(1, "#00ffff")

    canvasCtx.globalAlpha = 0.6
    canvasCtx.fillStyle = gradient
    canvasCtx.fillRect(x, HEIGHT / 2, barWidth - 2, barHeight)
    canvasCtx.globalAlpha = 1

    x += barWidth + 1
  }

  canvasCtx.strokeStyle = "#00ffff"
  canvasCtx.lineWidth = 2
  canvasCtx.beginPath()
  canvasCtx.moveTo(0, HEIGHT / 2)
  canvasCtx.lineTo(WIDTH, HEIGHT / 2)
  canvasCtx.stroke()
}

function drawWaveform(dataArray, bufferLength, WIDTH, HEIGHT) {
  canvasCtx.lineWidth = 3
  canvasCtx.strokeStyle = "#00ffff"
  canvasCtx.shadowBlur = 10
  canvasCtx.shadowColor = "#00ffff"

  canvasCtx.beginPath()

  const sliceWidth = WIDTH / bufferLength
  let x = 0

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0
    const y = (v * HEIGHT) / 2

    if (i === 0) {
      canvasCtx.moveTo(x, y)
    } else {
      canvasCtx.lineTo(x, y)
    }

    x += sliceWidth
  }

  canvasCtx.lineTo(WIDTH, HEIGHT / 2)
  canvasCtx.stroke()
  canvasCtx.shadowBlur = 0
}

function drawCircular(dataArray, bufferLength, WIDTH, HEIGHT) {
  const centerX = WIDTH / 2
  const centerY = HEIGHT / 2
  const radius = Math.min(WIDTH, HEIGHT) / 3

  const numBars = 360

  for (let i = 0; i < numBars; i++) {
    const dataIndex = Math.floor((i / numBars) * bufferLength)
    const barHeight = (dataArray[dataIndex] / 255) * (radius * 0.8)
    const angle = (i / numBars) * Math.PI * 2

    const x1 = centerX + Math.cos(angle) * radius
    const y1 = centerY + Math.sin(angle) * radius
    const x2 = centerX + Math.cos(angle) * (radius + barHeight)
    const y2 = centerY + Math.sin(angle) * (radius + barHeight)

    const gradient = canvasCtx.createLinearGradient(x1, y1, x2, y2)
    gradient.addColorStop(0, "#8000ff")
    gradient.addColorStop(1, "#ff00ff")

    canvasCtx.strokeStyle = gradient
    canvasCtx.lineWidth = 2
    canvasCtx.beginPath()
    canvasCtx.moveTo(x1, y1)
    canvasCtx.lineTo(x2, y2)
    canvasCtx.stroke()
  }

  canvasCtx.strokeStyle = "#00ffff"
  canvasCtx.lineWidth = 2
  canvasCtx.beginPath()
  canvasCtx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  canvasCtx.stroke()
}

function drawRetro3D(dataArray, bufferLength, WIDTH, HEIGHT) {
  const centerX = WIDTH / 2
  const centerY = HEIGHT / 2
  const time = Date.now() / 1000

  const avgIntensity = dataArray.reduce((a, b) => a + b, 0) / bufferLength / 255

  const pyramidSize = 200 + avgIntensity * 100
  const rotationY = time * 0.8
  const rotationX = Math.sin(time * 0.5) * 0.3

  function project3D(x, y, z) {
    const x1 = x * Math.cos(rotationY) - z * Math.sin(rotationY)
    const z1 = x * Math.sin(rotationY) + z * Math.cos(rotationY)

    const y1 = y * Math.cos(rotationX) - z1 * Math.sin(rotationX)
    const z2 = y * Math.sin(rotationX) + z1 * Math.cos(rotationX)

    const perspective = 800
    const scale = perspective / (perspective + z2 + 400)

    return {
      x: centerX + x1 * scale,
      y: centerY + y1 * scale,
      z: z2,
      scale: scale,
    }
  }

  function isValidPoint(point) {
    if (!isFinite(point.x) || !isFinite(point.y)) {
      return false
    }

    const margin = WIDTH * 2
    if (point.x < -margin || point.x > WIDTH + margin) {
      return false
    }
    if (point.y < -margin || point.y > HEIGHT + margin) {
      return false
    }

    return true
  }

  const apex = { x: 0, y: -pyramidSize, z: 0 }
  const base = [
    { x: pyramidSize, y: pyramidSize / 2, z: pyramidSize },
    { x: -pyramidSize, y: pyramidSize / 2, z: pyramidSize },
    { x: -pyramidSize, y: pyramidSize / 2, z: -pyramidSize },
    { x: pyramidSize, y: pyramidSize / 2, z: -pyramidSize },
  ]

  const apexProj = project3D(apex.x, apex.y, apex.z)
  const baseProj = base.map((v) => project3D(v.x, v.y, v.z))

  const faces = [
    { vertices: [apexProj, baseProj[0], baseProj[1]], color: "#ff00ff", intensity: dataArray[10] / 255 },
    { vertices: [apexProj, baseProj[1], baseProj[2]], color: "#00ffff", intensity: dataArray[30] / 255 },
    { vertices: [apexProj, baseProj[2], baseProj[3]], color: "#ff0080", intensity: dataArray[50] / 255 },
    { vertices: [apexProj, baseProj[3], baseProj[0]], color: "#ffff00", intensity: dataArray[70] / 255 },
  ]

  faces.forEach((face) => {
    const { vertices, color, intensity } = face

    const gradient = canvasCtx.createLinearGradient(vertices[0].x, vertices[0].y, vertices[1].x, vertices[1].y)
    gradient.addColorStop(
      0,
      `${color}${Math.floor((0.3 + intensity * 0.5) * 255)
        .toString(16)
        .padStart(2, "0")}`,
    )
    gradient.addColorStop(
      1,
      `${color}${Math.floor((0.1 + intensity * 0.3) * 255)
        .toString(16)
        .padStart(2, "0")}`,
    )

    canvasCtx.fillStyle = gradient
    canvasCtx.beginPath()
    canvasCtx.moveTo(vertices[0].x, vertices[0].y)
    canvasCtx.lineTo(vertices[1].x, vertices[1].y)
    canvasCtx.lineTo(vertices[2].x, vertices[2].y)
    canvasCtx.closePath()
    canvasCtx.fill()

    canvasCtx.strokeStyle = color
    canvasCtx.lineWidth = 2 + intensity * 3
    canvasCtx.shadowBlur = 15 + intensity * 10
    canvasCtx.shadowColor = color
    canvasCtx.beginPath()
    canvasCtx.moveTo(vertices[0].x, vertices[0].y)
    canvasCtx.lineTo(vertices[1].x, vertices[1].y)
    canvasCtx.lineTo(vertices[2].x, vertices[2].y)
    canvasCtx.closePath()
    canvasCtx.stroke()
    canvasCtx.shadowBlur = 0
  })

  canvasCtx.strokeStyle = "#8000ff"
  canvasCtx.lineWidth = 3
  canvasCtx.shadowBlur = 10
  canvasCtx.shadowColor = "#8000ff"
  canvasCtx.beginPath()
  baseProj.forEach((v, i) => {
    if (i === 0) canvasCtx.moveTo(v.x, v.y)
    else canvasCtx.lineTo(v.x, v.y)
  })
  canvasCtx.closePath()
  canvasCtx.stroke()
  canvasCtx.shadowBlur = 0

  const numParticles = 20
  for (let i = 0; i < numParticles; i++) {
    const angle = (i / numParticles) * Math.PI * 2 + time * 2
    const orbitRadius = pyramidSize * 1.5
    const particleX = Math.cos(angle) * orbitRadius
    const particleY = Math.sin(angle * 0.5) * pyramidSize * 0.5
    const particleZ = Math.sin(angle) * orbitRadius

    const particleProj = project3D(particleX, particleY, particleZ)
    const dataIdx = Math.floor((i / numParticles) * bufferLength)
    const particleIntensity = dataArray[dataIdx] / 255

    const particleSize = (3 + particleIntensity * 5) * particleProj.scale

    const particleGradient = canvasCtx.createRadialGradient(
      particleProj.x,
      particleProj.y,
      0,
      particleProj.x,
      particleProj.y,
      particleSize,
    )
    particleGradient.addColorStop(0, "#ffffff")
    particleGradient.addColorStop(0.5, "#ff00ff")
    particleGradient.addColorStop(1, "transparent")

    canvasCtx.fillStyle = particleGradient
    canvasCtx.beginPath()
    canvasCtx.arc(particleProj.x, particleProj.y, particleSize, 0, Math.PI * 2)
    canvasCtx.fill()
  }

  const gridSize = 10
  const gridSpacing = 80
  canvasCtx.strokeStyle = "rgba(255, 0, 255, 0.3)"
  canvasCtx.lineWidth = 1

  for (let i = -gridSize; i <= gridSize; i++) {
    const z1 = i * gridSpacing
    const x1Start = -gridSize * gridSpacing
    const x1End = gridSize * gridSpacing

    const start = project3D(x1Start, pyramidSize / 2 + 50, z1)
    const end = project3D(x1End, pyramidSize / 2 + 50, z1)

    canvasCtx.beginPath()
    canvasCtx.moveTo(start.x, start.y)
    canvasCtx.lineTo(end.x, end.y)
    canvasCtx.stroke()
  }

  for (let i = -gridSize; i <= gridSize; i++) {
    const x1 = i * gridSpacing
    const z1Start = -gridSize * gridSpacing
    const z1End = gridSize * gridSpacing

    const start = project3D(x1, pyramidSize / 2 + 50, z1Start)
    const end = project3D(x1, pyramidSize / 2 + 50, z1End)

    canvasCtx.beginPath()
    canvasCtx.moveTo(start.x, start.y)
    canvasCtx.lineTo(end.x, end.y)
    canvasCtx.stroke()
  }
}

function drawDialUpWaves(dataArray, bufferLength, WIDTH, HEIGHT) {
  const centerX = WIDTH / 2
  const centerY = HEIGHT / 2
  const time = Date.now() / 1000

  const avgIntensity = dataArray.reduce((a, b) => a + b, 0) / bufferLength / 255

  const numWaves = 30
  const maxRadius = Math.max(WIDTH, HEIGHT) * 0.8
  const waveSpeed = time * 100

  const tiltX = Math.PI / 6

  function project3D(x, y, z) {
    const y1 = y * Math.cos(tiltX) - z * Math.sin(tiltX)
    const z1 = y * Math.sin(tiltX) + z * Math.cos(tiltX)

    const perspective = 600
    const scale = perspective / (perspective + z1 + 200)

    return {
      x: centerX + x * scale,
      y: centerY + y1 * scale,
      z: z1,
      scale: scale,
    }
  }

  for (let wave = numWaves - 1; wave >= 0; wave--) {
    const waveProgress = ((wave / numWaves) * maxRadius + waveSpeed) % maxRadius
    const radius = waveProgress
    const opacity = 1 - waveProgress / maxRadius

    if (opacity <= 0) continue

    const dataIdx = Math.floor((wave / numWaves) * bufferLength)
    const intensity = dataArray[dataIdx] / 255

    const waveHeight = -100 - intensity * 150

    const segments = 80
    const points = []

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius

      const rippleOffset = Math.sin(angle * 4 + time * 3) * intensity * 20

      const projected = project3D(x + rippleOffset, y + rippleOffset, waveHeight)
      points.push(projected)
    }

    const colorStops = [
      { threshold: 0.7, color: "#ff00ff" },
      { threshold: 0.4, color: "#ff0080" },
      { threshold: 0, color: "#00ffff" },
    ]

    let waveColor = "#00ffff"
    for (const stop of colorStops) {
      if (intensity >= stop.threshold) {
        waveColor = stop.color
        break
      }
    }

    canvasCtx.strokeStyle = `${waveColor}${Math.floor(opacity * (0.6 + intensity * 0.4) * 255)
      .toString(16)
      .padStart(2, "0")}`
    canvasCtx.lineWidth = 2 + intensity * 3
    canvasCtx.shadowBlur = 10 + intensity * 10
    canvasCtx.shadowColor = waveColor
    canvasCtx.beginPath()
    points.forEach((point, i) => {
      if (i === 0) {
        canvasCtx.moveTo(point.x, point.y)
      } else {
        canvasCtx.lineTo(point.x, point.y)
      }
    })
    canvasCtx.stroke()
    canvasCtx.shadowBlur = 0

    if (wave % 3 === 0) {
      for (let i = 0; i < segments; i += 10) {
        const point = points[i]
        const nodeSize = (2 + intensity * 4) * point.scale

        canvasCtx.fillStyle = waveColor
        canvasCtx.shadowBlur = 8
        canvasCtx.shadowColor = waveColor
        canvasCtx.beginPath()
        canvasCtx.arc(point.x, point.y, nodeSize, 0, Math.PI * 2)
        canvasCtx.fill()
        canvasCtx.shadowBlur = 0
      }
    }
  }

  const modemSize = 20 + avgIntensity * 30
  const modemGradient = canvasCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, modemSize)
  modemGradient.addColorStop(0, "#ffffff")
  modemGradient.addColorStop(0.3, "#ff00ff")
  modemGradient.addColorStop(0.7, "#00ffff")
  modemGradient.addColorStop(1, "transparent")

  canvasCtx.fillStyle = modemGradient
  canvasCtx.beginPath()
  canvasCtx.arc(centerX, centerY, modemSize, 0, Math.PI * 2)
  canvasCtx.fill()

  const ringRadius = modemSize + 10 + Math.sin(time * 4) * 5
  canvasCtx.strokeStyle = `rgba(255, 0, 255, ${0.6 + avgIntensity * 0.4})`
  canvasCtx.lineWidth = 3
  canvasCtx.shadowBlur = 15
  canvasCtx.shadowColor = "#ff00ff"
  canvasCtx.beginPath()
  canvasCtx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2)
  canvasCtx.stroke()
  canvasCtx.shadowBlur = 0

  canvasCtx.strokeStyle = "rgba(0, 255, 255, 0.05)"
  canvasCtx.lineWidth = 1
  for (let i = 0; i < HEIGHT; i += 3) {
    canvasCtx.beginPath()
    canvasCtx.moveTo(0, i)
    canvasCtx.lineTo(WIDTH, i)
    canvasCtx.stroke()
  }
}

function drawDialUpSpectrum(dataArray, bufferLength, WIDTH, HEIGHT) {
  const centerX = WIDTH * 0.5
  const centerY = HEIGHT * 0.55

  const currentSlice = Array.from(dataArray)
  spectrogramHistory.push(currentSlice)

  if (spectrogramHistory.length > maxHistoryLength) {
    spectrogramHistory.shift()
  }

  function project3D(x, y, z) {
    const rotateY = 0
    const x1 = x * Math.cos(rotateY) - z * Math.sin(rotateY)
    const z1 = x * Math.sin(rotateY) + z * Math.cos(rotateY)

    const tiltX = Math.PI / 10

    const y1 = y * Math.cos(tiltX) - z1 * Math.sin(tiltX)
    const z2 = y * Math.sin(tiltX) + z1 * Math.cos(tiltX)

    const perspective = 900
    const scale = perspective / (perspective + z2)

    return {
      x: centerX + x1 * scale,
      y: centerY + y1 * scale,
      z: z2,
      scale: scale,
    }
  }

  function isValidPoint(point) {
    if (!isFinite(point.x) || !isFinite(point.y)) {
      return false
    }

    const margin = WIDTH * 2
    if (point.x < -margin || point.x > WIDTH + margin) {
      return false
    }
    if (point.y < -margin || point.y > HEIGHT + margin) {
      return false
    }

    return true
  }

  function getHeatMapColor(intensity) {
    if (isNaN(intensity) || intensity < 0) intensity = 0
    if (intensity > 1) intensity = 1

    if (intensity < 0.2) {
      const t = intensity / 0.2
      return {
        r: 0,
        g: Math.floor(t * 255),
        b: 255,
      }
    } else if (intensity < 0.4) {
      const t = (intensity - 0.2) / 0.2
      return {
        r: 0,
        g: 255,
        b: Math.floor((1 - t) * 255),
      }
    } else if (intensity < 0.6) {
      const t = (intensity - 0.4) / 0.2
      return {
        r: Math.floor(t * 255),
        g: 255,
        b: 0,
      }
    } else if (intensity < 0.8) {
      const t = (intensity - 0.6) / 0.2
      return {
        r: 255,
        g: Math.floor((1 - t * 0.5) * 255),
        b: 0,
      }
    } else {
      const t = (intensity - 0.8) / 0.2
      return {
        r: 255,
        g: Math.floor((1 - t) * 128),
        b: 0,
      }
    }
  }

  const gridSize = 10
  const gridSpacing = 50
  canvasCtx.strokeStyle = "rgba(100, 100, 100, 0.3)"
  canvasCtx.lineWidth = 1

  for (let i = 0; i <= gridSize; i++) {
    const z = i * gridSpacing - 300
    const xStart = -WIDTH * 0.45
    const xEnd = WIDTH * 0.45

    const start = project3D(xStart, 0, z)
    const end = project3D(xEnd, 0, z)

    if (isValidPoint(start) && isValidPoint(end)) {
      canvasCtx.beginPath()
      canvasCtx.moveTo(start.x, start.y)
      canvasCtx.lineTo(end.x, end.y)
      canvasCtx.stroke()
    }
  }

  const numFreqLines = 20
  for (let i = 0; i <= numFreqLines; i++) {
    const x = (i / numFreqLines - 0.5) * WIDTH * 0.9
    const zStart = -300
    const zEnd = gridSize * gridSpacing - 300

    const start = project3D(x, 0, zStart)
    const end = project3D(x, 0, zEnd)

    if (isValidPoint(start) && isValidPoint(end)) {
      canvasCtx.beginPath()
      canvasCtx.moveTo(start.x, start.y)
      canvasCtx.lineTo(end.x, end.y)
      canvasCtx.stroke()
    }
  }

  const numFreqBands = 80

  for (let timeIdx = spectrogramHistory.length - 1; timeIdx >= 0; timeIdx--) {
    const slice = spectrogramHistory[timeIdx]
    const z = (timeIdx - spectrogramHistory.length) * 15 + 300

    if (z < -1000) continue

    const points = []

    for (let freqIdx = 0; freqIdx <= numFreqBands; freqIdx++) {
      const dataIndex = Math.floor((freqIdx / numFreqBands) * bufferLength)
      const intensity = slice[dataIndex] / 255

      const x = (freqIdx / numFreqBands - 0.5) * WIDTH * 0.9
      const y = -intensity * 300

      const projected = project3D(x, y, z)
      points.push({ projected, intensity })
    }

    if (timeIdx < spectrogramHistory.length - 1) {
      const nextSlice = spectrogramHistory[timeIdx + 1]
      const nextZ = (timeIdx + 1 - spectrogramHistory.length) * 15 + 300

      if (nextZ >= -1000) {
        const nextPoints = []

        for (let freqIdx = 0; freqIdx <= numFreqBands; freqIdx++) {
          const dataIndex = Math.floor((freqIdx / numFreqBands) * bufferLength)
          const intensity = nextSlice[dataIndex] / 255
          const x = (freqIdx / numFreqBands - 0.5) * WIDTH * 0.9
          const y = -intensity * 300
          const projected = project3D(x, y, nextZ)
          nextPoints.push({ projected, intensity })
        }

        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i]
          const p2 = points[i + 1]
          const p3 = nextPoints[i + 1]
          const p4 = nextPoints[i]

          if (
            isValidPoint(p1.projected) &&
            isValidPoint(p2.projected) &&
            isValidPoint(p3.projected) &&
            isValidPoint(p4.projected)
          ) {
            const quadIntensity = (p1.intensity + p2.intensity + p3.intensity + p4.intensity) / 4
            const color = getHeatMapColor(quadIntensity)
            const depthFactor = Math.max(0, 1 - Math.abs(z) / 1200)
            const alpha = depthFactor * (0.6 + quadIntensity * 0.4)

            canvasCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.7})`
            canvasCtx.beginPath()
            canvasCtx.moveTo(p1.projected.x, p1.projected.y)
            canvasCtx.lineTo(p2.projected.x, p2.projected.y)
            canvasCtx.lineTo(p3.projected.x, p3.projected.y)
            canvasCtx.lineTo(p4.projected.x, p4.projected.y)
            canvasCtx.closePath()
            canvasCtx.fill()
          }
        }
      }
    }

    const validPoints = points.filter((p) => isValidPoint(p.projected))

    if (validPoints.length > 1) {
      const avgIntensity = validPoints.reduce((sum, p) => sum + p.intensity, 0) / validPoints.length
      const color = getHeatMapColor(avgIntensity)
      const depthFactor = Math.max(0, 1 - Math.abs(z) / 1200)
      const alpha = depthFactor * (0.8 + avgIntensity * 0.2)

      canvasCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
      canvasCtx.lineWidth = 1.5 + avgIntensity * 1.5
      canvasCtx.shadowBlur = 5
      canvasCtx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.8})`

      canvasCtx.beginPath()
      validPoints.forEach((point, i) => {
        if (i === 0) {
          canvasCtx.moveTo(point.projected.x, point.projected.y)
        } else {
          canvasCtx.lineTo(point.projected.x, point.projected.y)
        }
      })
      canvasCtx.stroke()
      canvasCtx.shadowBlur = 0
    }
  }

  canvasCtx.fillStyle = "#00ffff"
  canvasCtx.font = '18px "VT323", monospace'
  canvasCtx.textAlign = "center"
  canvasCtx.shadowBlur = 8
  canvasCtx.shadowColor = "#00ffff"
  canvasCtx.fillText("FREQUENCY (Hz)", WIDTH / 2, HEIGHT - 10)

  canvasCtx.save()
  canvasCtx.translate(20, HEIGHT / 2)
  canvasCtx.rotate(-Math.PI / 2)
  canvasCtx.fillText("AMPLITUDE (dB)", 0, 0)
  canvasCtx.restore()

  canvasCtx.shadowBlur = 0

  const legendX = WIDTH - 150
  const legendY = 30
  const legendWidth = 120
  const legendBarHeight = 15

  canvasCtx.fillStyle = "#00ffff"
  canvasCtx.font = '14px "VT323", monospace'
  canvasCtx.textAlign = "left"
  canvasCtx.shadowBlur = 5
  canvasCtx.shadowColor = "#00ffff"
  canvasCtx.fillText("INTENSITY", legendX, legendY)

  const gradient = canvasCtx.createLinearGradient(legendX, 0, legendX + legendWidth, 0)

  for (let i = 0; i <= 10; i++) {
    const intensity = i / 10
    const color = getHeatMapColor(intensity)
    gradient.addColorStop(intensity, `rgb(${color.r}, ${color.g}, ${color.b})`)
  }

  canvasCtx.fillStyle = gradient
  canvasCtx.fillRect(legendX, legendY + 10, legendWidth, legendBarHeight)

  canvasCtx.strokeStyle = "#ff00ff"
  canvasCtx.lineWidth = 2
  canvasCtx.shadowBlur = 8
  canvasCtx.shadowColor = "#ff00ff"
  canvasCtx.strokeRect(legendX, legendY + 10, legendWidth, legendBarHeight)

  canvasCtx.font = '12px "VT323", monospace'
  canvasCtx.fillStyle = "#ff00ff"
  canvasCtx.textAlign = "left"
  canvasCtx.shadowBlur = 3
  canvasCtx.shadowColor = "#ff00ff"
  canvasCtx.fillText("LOW", legendX, legendY + legendBarHeight + 22)

  canvasCtx.textAlign = "center"
  canvasCtx.fillText("MED", legendX + legendWidth / 2, legendY + legendBarHeight + 22)

  canvasCtx.textAlign = "right"
  canvasCtx.fillText("HIGH", legendX + legendWidth, legendY + legendBarHeight + 22)

  canvasCtx.shadowBlur = 0
}

function drawGrid(WIDTH, HEIGHT) {
  canvasCtx.strokeStyle = "rgba(255, 0, 255, 0.1)"
  canvasCtx.lineWidth = 1

  for (let i = 0; i < HEIGHT; i += 20) {
    canvasCtx.beginPath()
    canvasCtx.moveTo(0, i)
    canvasCtx.lineTo(WIDTH, i)
    canvasCtx.stroke()
  }

  for (let i = 0; i < WIDTH; i += 20) {
    canvasCtx.beginPath()
    canvasCtx.moveTo(i, 0)
    canvasCtx.lineTo(i, HEIGHT)
    canvasCtx.stroke()
  }
}

visualize()

window.addEventListener("resize", () => {
  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight
})

function updateActiveFile() {
  const fileItems = fileList.querySelectorAll(".file-item")
  fileItems.forEach((item, index) => {
    if (index === currentTrackIndex) {
      item.classList.add("active")
    } else {
      item.classList.remove("active")
    }
  })
}

function getNextTrackIndex() {
  const totalTracks = audioFiles.length + radioStations.length

  if (isShuffleEnabled) {
    if (shuffledIndices.length === 0) {
      generateShuffledIndices()
    }

    const currentShufflePos = shuffledIndices.indexOf(currentTrackIndex)
    if (currentShufflePos < shuffledIndices.length - 1) {
      return shuffledIndices[currentShufflePos + 1]
    } else {
      generateShuffledIndices()
      return shuffledIndices[0]
    }
  } else {
    if (currentTrackIndex < totalTracks - 1) {
      return currentTrackIndex + 1
    }
    return -1
  }
}

function getPreviousTrackIndex() {
  if (isShuffleEnabled) {
    if (shuffledIndices.length === 0) {
      generateShuffledIndices()
    }

    const currentShufflePos = shuffledIndices.indexOf(currentTrackIndex)
    if (currentShufflePos > 0) {
      return shuffledIndices[currentShufflePos - 1]
    }
    return -1
  } else {
    if (currentTrackIndex > 0) {
      return currentTrackIndex - 1
    }
    return -1
  }
}

fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`)
    })
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }
})

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    fullscreenBtn.classList.add("active")
  } else {
    fullscreenBtn.classList.remove("active")
  }
})

plusBtn.addEventListener("click", () => {
  plusBtn.classList.toggle("active")
})

eqToggleBtn.addEventListener("click", () => {
  equalizerWindow.classList.toggle("hidden")
  eqToggleBtn.classList.toggle("active")
})
