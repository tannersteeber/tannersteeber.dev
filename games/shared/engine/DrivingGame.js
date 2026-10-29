/* DrivingGame — shared game shell used by Cruise and Cutup.
 * Owns the renderer, loop, input, audio, vehicle, camera, environment, HUD, menus and settings,
 * and runs the state machine: title → playing ⇄ paused → (crashed → over). Games subclass it and
 * provide the road, scenery, rules and HUD content. */
import * as THREE from '../../vendor/three.module.js';
import { SettingsManager, SiteTheme } from './SettingsManager.js?v=arcade-platform-1';
import { GameRenderer, QUALITY, webglAvailable } from './Renderer.js';
import { GameEngine } from './GameEngine.js';
import { InputManager } from './InputManager.js';
import { AudioManager } from './AudioManager.js';
import { AssetManager } from './AssetManager.js';
import { VehicleController, VEHICLE_PRESETS } from './VehicleController.js';
import { CameraController, CAMERA_MODES } from './CameraController.js';
import { Environment, getPalette } from './Environment.js';
import { GameMenu } from '../ui/GameMenu.js?v=arcade-platform-1';
import { GameHUD } from '../ui/GameHUD.js?v=20261026-brand-1';
import { SettingsPanel } from '../ui/SettingsPanel.js?v=20261026-brand-1';
import { h } from '../ui/dom.js';

export class DrivingGame {
  /**
   * cfg: { id, title, tagline, blurb, preset, hudFields, controlsExtra, settingsFields, backHref, vehicleExtra }
   */
  constructor(cfg) { this.cfg = cfg; this.state = 'loading'; }

  /* ---------- hooks for subclasses ---------- */
  createRoad() { throw new Error('createRoad() not implemented'); }
  resetRun() {}
  updateRun(dt, state, input) {}
  updateHud() {}
  titleRecord() { return ''; }
  onPaletteApplied() {}
  saveRecords() {}
  demoSpeed() { return 20; }

  get quality() { return QUALITY[this.settings.get('graphics')]; }
  get view() { return this.quality.view; }

  async init(root) {
    this.root = root;
    SiteTheme.apply();
    this.settings = new SettingsManager();
    const id = this.cfg.id;
    if (!webglAvailable()) { this._fatal('WebGL is not available in this browser, so the 3D game cannot start.'); return; }
    try {
      this.gr = new GameRenderer(root, this.settings.get('graphics'));
    } catch (e) { this._fatal('Could not start the 3D renderer on this device.'); return; }
    this._onContextLost = (e) => { e.preventDefault(); this.engine?.stop(); this._fatal('The graphics context was lost. Reload the page to continue.'); };
    this.gr.canvas.addEventListener('webglcontextlost', this._onContextLost);

    this.scene = this.gr.scene;
    this.assets = new AssetManager();
    this.env = new Environment(this.scene, this.gr.camera);
    this.input = new InputManager(root, this.settings);
    this.audio = new AudioManager(this.settings);
    this.cameraCtl = new CameraController(this.gr.camera);
    this.cameraCtl.setMode(this.settings.get(id + '.camera'));

    this.palette = getPalette(this.settings, id);
    this.road = this.createRoad();
    this.scene.add(this.road.group);
    this.road.quality = this.quality.density;

    this.vehicle = new VehicleController(this.road, Object.assign({}, VEHICLE_PRESETS[this.cfg.preset], this.cfg.vehicleExtra));
    this.car = this.assets.createPlayerCar(this.palette.accent.getHex());
    this.scene.add(this.car.group, this.car.shadow);
    this.car.shadow.rotation.order = 'YXZ';
    this.headlight = new THREE.PointLight(0xfff1c8, 0, 55, 1.4);
    this.scene.add(this.headlight);

    this._buildUi();
    this.engine = new GameEngine(this.gr);
    this.engine.update = (dt) => this._frame(dt);
    this.engine.onHidden = () => { if (this.state === 'playing') this.pause(); };

    this.input.onPause = () => this._togglePause();
    this._off = this.settings.onChange((k) => this._onSetting(k));
    this._onHide = () => this.saveRecords();
    window.addEventListener('pagehide', this._onHide);

    this.applyPalette();
    this.restWorld();
    // pre-build the road around the start so the first frame has no gaps
    this.road.update(this.vehicle.s, this.view, 110, Infinity);
    this.state = 'title';
    this.hud.show(false);
    this._showTitle();
    this.engine.start();
    root.classList.add('ready');
  }

  _fatal(msg) {
    this.root.append(h('div', { class: 'g-menu on' }, h('section', { class: 'g-screen' }, h('div', { class: 'g-card' },
      h('h2', { class: 'g-h2', text: 'Cannot start' }), h('p', { class: 'g-blurb', text: msg }),
      h('div', { class: 'g-actions' }, h('a', { class: 'g-btn g-btn-primary', href: this.cfg.backHref, text: 'Back to Arcade' }))))));
    this.root.classList.add('ready');
  }

  _buildUi() {
    const cfg = this.cfg;
    const hooks = {
      onClick: () => { this.audio.unlock(); this.audio.click(); },
      onPlay: () => this.startRun(),
      onResume: () => this.resume(),
      onRestart: () => this.startRun(),
      onFinish: this.platform ? () => this.finishPractice() : null,
      onSettings: () => this.panel.open(),
      onEnableTilt: async () => { await this.input.tilt.enable(); this._showTitle(); this.panel.refresh(); }
    };
    this.menu = new GameMenu(this.root, this.settings, Object.assign({
      id: cfg.id, title: cfg.title, tagline: cfg.tagline, blurb: cfg.blurb, backHref: cfg.backHref, controlsExtra: cfg.controlsExtra
    }, hooks));
    this.hud = new GameHUD(this.root, cfg.hudFields, {
      id: cfg.id, title: cfg.title,
      onPause: () => this._togglePause(),
      onPedal: (v) => { this.input.pedal = v; }
    });
    this.panel = new SettingsPanel(this.root, this.settings, this.input, this._fields(), {
      onTheme: () => this.applyPalette(),
      onClose: () => { if (this.state === 'title') this._showTitle(); }
    });
  }

  _fields() {
    const id = this.cfg.id;
    return [{
      type: 'select', key: id + '.camera', label: 'Camera',
      options: Object.keys(CAMERA_MODES).map(k => [k, CAMERA_MODES[k].label])
    }].concat(this.cfg.settingsFields || []);
  }

  _showTitle() {
    const tiltMode = this.settings.controlMode() === 'tilt';
    this.menu.showTitle(this.titleRecord(), tiltMode && !this.input.tilt.active && this.input.tilt.status !== 'unavailable');
  }

  _onSetting(key) {
    const id = this.cfg.id;
    if (key === id + '.camera') this.cameraCtl.setMode(this.settings.get(key));
    else if (key === 'carColor') this.assets.repaintPlayer(this.car, this.playerPaint());
    else if (key === 'graphics') { this.gr.setQuality(this.settings.get('graphics')); this.road.quality = this.quality.density; this.applyPalette(); }
    else if (key === id + '.timeOfDay' || key === id + '.weather') this.applyPalette();
    else if (key === 'mobileMode' || key === 'desktopMode') { this.input.reset(); if (this.state === 'title') this._showTitle(); }
  }

  playerPaint() {
    return this.palette.page === 'signature' ? new THREE.Color(this.settings.get('carColor')).getHex() : this.palette.accent.getHex();
  }

  /** Re-skin the whole world from the current page theme / light-dark / time of day / weather. */
  applyPalette() {
    this.palette = getPalette(this.settings, this.cfg.id);
    this.env.apply(this.palette, this.view);
    this.env.update(0, this.vehicle.position.y);
    this.gr.renderer.setClearColor(this.palette.fog);
    this.assets.repaintPlayer(this.car, this.playerPaint());
    this.headlight.intensity = this.palette.lampsOn && this.settings.get('graphics') !== 'low' ? 2.2 : 0;
    this.road.quality = this.quality.density;
    this.onPaletteApplied();
    this.road.rebuildAll();
    if (this.vehicle) this.road.update(this.vehicle.s, this.view, 110, Infinity);
  }

  /** Put the car back at the start of the road (title screen / new run). */
  restWorld() {
    this.saveRecords();
    this.road.reset();
    this.vehicle.reset(0, this.demoSpeed());
    this.vehicle.autoSpeed = true;
    this.vehicle.targetSpeed = this.demoSpeed();
    this.vehicle.assist = 1;
    this.cameraCtl.snap();
    this.resetRun();
    this.vehicle.applyTo(this.car.group);
    this.assets.setBraking(this.car, false);
    this.road.update(this.vehicle.s, this.view, 110, Infinity);
  }

  async startRun() {
    if (this.platform && !this._starting) {
      this._starting = true;
      try {
        if (this.platform.session && this.runMetrics && ['playing','paused','over','crashed'].includes(this.state)) await this.platform.retry(() => this.platform.practice(this.runMetrics()));
        await this.platform.retry(() => this.platform.start(true));
      } finally { this._starting = false; }
    } else if (this._starting) return;
    this.audio.unlock();
    this.panel.close();
    this.restWorld();
    this.vehicle.assist = 0;
    this.state = 'playing';
    this.menu.hide();
    this.hud.show(true);
    this.input.setEnabled(true);
    this.hud.show(true);
    this.updateHud();
    this.audio.setRunning(true);
    const mode = this.settings.controlMode();
    if (mode === 'tilt') {
      const t = this.input.tilt;
      if (t.active) t.calibrate();
      else if (!t.needsPermission && t.status === 'idle') t.enable().then(ok => { if (!ok) this.hud.toast('Tilt unavailable — use touch', 'info'); });
      else this.hud.toast('Tilt is off — touch steering active', 'info');
    }
    this.onRunStart && this.onRunStart();
  }

  async finishPractice() {
    if(this._finishing)return;this._finishing=true;this.pause();
    try{if(this.platform?.session)await this.platform.retry(()=>this.platform.practice(this.runMetrics()));await this.platform?.retry(()=>this.platform.save());location.assign(this.cfg.backHref);}finally{this._finishing=false;}
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.setEnabled(false);
    this.audio.setRunning(false);
    this.saveRecords();
    this.hud.show(false);
    this.menu.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.panel.close();
    this.state = 'playing';
    this.menu.hide();
    this.input.setEnabled(true);
    this.hud.show(true);
    this.updateHud();
    this.audio.setRunning(true);
    if (this.settings.controlMode() === 'tilt' && this.input.tilt.active) this.input.tilt.calibrate();
  }

  _togglePause() {
    if (this.panel.isOpen) { this.panel.close(); return; }
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
    else if (this.state === 'title' || this.state === 'over') this.menu.toggleTools(this.state === 'title');
  }

  /** Called by subclasses when the run ends. */
  endRun(overInfo, delay = 0) {
    if (this.platform && this.runMetrics) this.platform.practice(this.runMetrics()).catch(e => this.platform.problem(e, () => this.platform.practice(this.runMetrics())));
    this.state = 'crashed';
    this.input.setEnabled(false);
    this.audio.setRunning(false);
    clearTimeout(this._overT);
    this._overT = setTimeout(() => {
      if (this.state !== 'crashed') return;
      this.state = 'over';
      this.hud.show(false);
      this.menu.showOver(overInfo());
    }, delay * 1000);
  }

  _frame(dt) {
    const st = this.state;
    if (st === 'paused' || st === 'loading') return;
    this.input.update(dt);
    const playing = st === 'playing';
    const inp = playing ? { steer: this.input.steer, throttle: this.input.throttle } : { steer: 0, throttle: 0 };
    const v = this.vehicle;

    this.beforeVehicle && this.beforeVehicle(dt, inp, st);
    v.update(dt, inp);
    this.assets.setBraking(this.car, playing && (inp.throttle < 0 || (v.autoSpeed && v.targetSpeed < v.speed - 0.5 && v.accelNow < -0.8)));
    this.updateRun(dt, st, inp);

    this.road.update(v.s, this.view, 110, 1);
    v.applyTo(this.car.group);
    this.car.shadow.position.set(v.position.x, v.position.y + 0.07, v.position.z);
    this.car.shadow.rotation.set(-Math.PI / 2, v.yaw, 0);
    this.headlight.position.set(v.position.x + Math.sin(v.yaw) * 7, v.position.y + 1.6, v.position.z + Math.cos(v.yaw) * 7);

    const speed01 = Math.min(1, v.speed / v.cfg.maxSpeed);
    this.cameraCtl.update(dt, v, this.car.group, speed01);
    this.car.group.visible = !this.cameraCtl.hidesCar;
    this.car.shadow.visible = this.car.group.visible;
    this.env.update(dt, v.position.y);
    this.audio.update(speed01, Math.abs(v.lat) / 6, v.offRoad || v.scraping ? 1 : 0);

    this._hudT = (this._hudT || 0) + dt;
    if (this._hudT > 0.1) { this._hudT = 0; if (playing || st === 'crashed') this.updateHud(); }
  }

  destroy() {
    clearTimeout(this._overT);
    this.gr?.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this.saveRecords();
    window.removeEventListener('pagehide', this._onHide);
    this._off && this._off();
    this.engine && this.engine.destroy();
    this.panel && this.panel.destroy();
    this.input && this.input.destroy();
    this.audio && this.audio.destroy();
    this.road && this.road.dispose();
    this.env && this.env.dispose();
    this.assets && this.assets.dispose();
    this.gr && this.gr.dispose();
  }
}
