import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface DeviceInfo {
  id: string;
  state: 'device' | 'offline' | 'unauthorized' | 'unknown';
  model?: string;
  product?: string;
  transportId?: string;
}

export interface DeviceProperties {
  model: string;
  manufacturer: string;
  androidVersion: string;
  sdkVersion: string;
  abi: string;
  screenDensity?: string;
}

export class AdbHelper {
  private adbPath: string;

  constructor() {
    this.adbPath = this.resolveAdbPath();
  }

  /**
   * Resolves the ADB binary path across environment locations.
   */
  private resolveAdbPath(): string {
    // 1. Check ANDROID_HOME
    if (process.env.ANDROID_HOME) {
      const p = path.join(process.env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
      if (fs.existsSync(p)) return p;
    }

    // 2. Check standard Windows LocalAppData
    if (process.env.LOCALAPPDATA) {
      const p = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
      if (fs.existsSync(p)) return p;
    }

    // 3. Fallback to global PATH
    return 'adb';
  }

  /**
   * Executes an ADB command with arguments.
   */
  exec(args: string[], options: { timeout?: number } = {}): { stdout: string; stderr: string; status: number } {
    try {
      const res = spawnSync(this.adbPath, args, {
        encoding: 'utf8',
        timeout: options.timeout || 30000,
        shell: false,
      });

      return {
        stdout: res.stdout || '',
        stderr: res.stderr || '',
        status: res.status !== null ? res.status : 1,
      };
    } catch (err: any) {
      return {
        stdout: '',
        stderr: err.message || String(err),
        status: 1,
      };
    }
  }

  /**
   * Detects all connected physical and emulated Android devices.
   */
  detectDevices(): DeviceInfo[] {
    const res = this.exec(['devices', '-l']);
    if (res.status !== 0) return [];

    const lines = res.stdout.split('\n');
    const devices: DeviceInfo[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('List of devices')) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const id = parts[0];
        const stateStr = parts[1];
        let state: DeviceInfo['state'] = 'unknown';
        if (stateStr === 'device') state = 'device';
        else if (stateStr === 'offline') state = 'offline';
        else if (stateStr === 'unauthorized') state = 'unauthorized';

        let model: string | undefined;
        let product: string | undefined;
        let transportId: string | undefined;

        for (const token of parts.slice(2)) {
          if (token.startsWith('model:')) model = token.replace('model:', '');
          if (token.startsWith('product:')) product = token.replace('product:', '');
          if (token.startsWith('transport_id:')) transportId = token.replace('transport_id:', '');
        }

        devices.push({ id, state, model, product, transportId });
      }
    }

    return devices;
  }

  /**
   * Gets hardware and software properties of a connected device.
   */
  getDeviceProperties(serial: string): DeviceProperties {
    const getProp = (propName: string) => {
      const res = this.exec(['-s', serial, 'shell', 'getprop', propName]);
      return res.stdout.trim();
    };

    return {
      model: getProp('ro.product.model') || 'Unknown',
      manufacturer: getProp('ro.product.manufacturer') || 'Unknown',
      androidVersion: getProp('ro.build.version.release') || 'Unknown',
      sdkVersion: getProp('ro.build.version.sdk') || 'Unknown',
      abi: getProp('ro.product.cpu.abi') || 'Unknown',
      screenDensity: getProp('ro.sf.lcd_density') || undefined,
    };
  }

  /**
   * Installs an APK file onto the target device.
   */
  installApk(serial: string, apkPath: string): { success: boolean; output: string } {
    const res = this.exec(['-s', serial, 'install', '-r', apkPath], { timeout: 60000 });
    const success = res.status === 0 && res.stdout.includes('Success');
    return { success, output: res.stdout || res.stderr };
  }

  /**
   * Clears app package data.
   */
  clearAppData(serial: string, appId: string): boolean {
    const res = this.exec(['-s', serial, 'shell', 'pm', 'clear', appId]);
    return res.status === 0 && res.stdout.includes('Success');
  }

  /**
   * Launches the app's main launcher activity.
   */
  launchApp(serial: string, appId: string, activity: string): boolean {
    const fullActivity = activity.startsWith('.') ? `${appId}/${activity}` : `${appId}/${activity}`;
    const res = this.exec(['-s', serial, 'shell', 'am', 'start', '-n', fullActivity]);
    return res.status === 0 && !res.stderr.includes('Error');
  }

  /**
   * Force stops the application.
   */
  forceStopApp(serial: string, appId: string): boolean {
    const res = this.exec(['-s', serial, 'shell', 'am', 'force-stop', appId]);
    return res.status === 0;
  }

  /**
   * Sends an Android keyevent (e.g. 4 for BACK, 3 for HOME).
   */
  sendKeyEvent(serial: string, keyCode: number): boolean {
    const res = this.exec(['-s', serial, 'shell', 'input', 'keyevent', String(keyCode)]);
    return res.status === 0;
  }

  /**
   * Inputs text into the currently focused input.
   */
  inputText(serial: string, text: string): boolean {
    const escaped = text.replace(/ /g, '%s');
    const res = this.exec(['-s', serial, 'shell', 'input', 'text', escaped]);
    return res.status === 0;
  }

  /**
   * Simulates a screen tap at (x, y).
   */
  tap(serial: string, x: number, y: number): boolean {
    const res = this.exec(['-s', serial, 'shell', 'input', 'tap', String(x), String(y)]);
    return res.status === 0;
  }

  /**
   * Captures a screenshot from the device and saves it directly to a local PNG file.
   */
  takeScreenshot(serial: string, outputPath: string): boolean {
    try {
      const res = spawnSync(this.adbPath, ['-s', serial, 'exec-out', 'screencap', '-p'], {
        maxBuffer: 10 * 1024 * 1024,
      });

      if (res.status === 0 && res.stdout && res.stdout.length > 0) {
        fs.writeFileSync(outputPath, res.stdout);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Fetches recent logcat output.
   */
  getLogcat(serial: string, lineCount: number = 200): string {
    const res = this.exec(['-s', serial, 'logcat', '-d', '-t', String(lineCount)]);
    return res.stdout || res.stderr;
  }

  /**
   * Checks the currently focused / top window or activity.
   */
  getTopActivity(serial: string): string {
    const res = this.exec(['-s', serial, 'shell', 'dumpsys', 'window', 'windows']);
    const mFocused = res.stdout.match(/mFocusedApp=.*ActivityRecord\{.* ([\w\.\/]+) /);
    if (mFocused && mFocused[1]) return mFocused[1];

    const mCurrent = res.stdout.match(/mCurrentFocus=Window\{.* ([\w\.\/]+)\}/);
    if (mCurrent && mCurrent[1]) return mCurrent[1];

    return '';
  }
}
