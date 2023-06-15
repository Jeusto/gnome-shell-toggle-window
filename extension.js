const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Workspace = imports.ui.workspace.Workspace;
const ExtensionUtils = imports.misc.extensionUtils;

class Extension {
  toggleWindow() {
    if (
      !this.cached_window_actor ||
      !this.cached_window_actor.metaWindow ||
      !this.cached_window_actor.metaWindow.get_workspace
    ) {
      let windows = global.get_window_actors().filter((actor) => {
        return (
          actor.metaWindow.get_wm_class() === "Gnome-terminal" &&
          actor.metaWindow.get_title() === "ToggleTerminal"
        );
      });

      // Launche new instance if there's none
      if (!windows.length) {
        imports.misc.util.trySpawnCommandLine(
          "/usr/bin/gnome-terminal --title='ToggleTerminal' --profile='Transparent' --geometry=800x400+0+0"
        );
        return;
      }

      this.cached_window_actor = windows[0];
    }

    let win = this.cached_window_actor.metaWindow;
    let focusWindow = global.display.focus_window;

    // Already active, hide it
    if (win === focusWindow) {
      win.minimize();
      return;
    }

    // Not active, activate it
    let activeWorkspace = global.workspace_manager.get_active_workspace();
    let currentMonitor = activeWorkspace.get_display().get_current_monitor();
    let onCurrentMonitor = win.get_monitor() === currentMonitor;
    if (!win.located_on_workspace(activeWorkspace)) {
      win.change_workspace(activeWorkspace);
      onCurrentMonitor || win.move_to_monitor(currentMonitor);
    } else if (win.minimized && !onCurrentMonitor) {
      win.move_to_monitor(currentMonitor);
    }
    activeWorkspace.activate_with_focus(win, global.get_current_time());
  }

  enable() {
    this.settings = ExtensionUtils.getSettings();

    // Bind hotkey
    this.bindHotkey();
    this.settings.connect("changed::toggle-key", () => {
      this.bindHotkey();
    });

    // Hide from workspace overview
    this.hideOnOverview();

    // Disable animation when hiding
    if (Main.wm._shouldAnimateActor) {
      this._shouldAnimateActor_bkp = Main.wm._shouldAnimateActor;
      Main.wm._shouldAnimateActor = (actor, types) => {
        if (
          actor.metaWindow &&
          actor.metaWindow.get_wm_class() === "Gnome-terminal"
        )
          return false;
        return this._shouldAnimateActor_bkp.call(Main.wm, actor, types);
      };
    }
  }

  bindHotkey() {
    Main.wm.removeKeybinding("toggle-key");
    this.cached_window_actor = null;
    let ModeType = Shell.hasOwnProperty("ActionMode")
      ? Shell.ActionMode
      : Shell.KeyBindingMode;
    Main.wm.addKeybinding(
      "toggle-key",
      this.settings,
      Meta.KeyBindingFlags.NONE,
      ModeType.NORMAL | ModeType.OVERVIEW,
      this.toggleWindow.bind(this)
    );
  }

  hideOnOverview() {
    this._isOverviewWindow_bkp = Workspace.prototype._isOverviewWindow;

    Workspace.prototype._isOverviewWindow = (win) => {
      if (win.get_wm_class && win.get_wm_class() === "Gnome-terminal") {
        return false;
      }

      return this._isOverviewWindow_bkp.call(Workspace, win);
    };
  }

  disable() {
    Main.wm.removeKeybinding("toggle-key");
    this.cached_window_actor = null;

    if (this._shouldAnimateActor_bkp) {
      Main.wm._shouldAnimateActor = this._shouldAnimateActor_bkp;
      this._shouldAnimateActor_bkp = null;
    }

    if (this._isOverviewWindow_bkp) {
      Workspace.prototype._isOverviewWindow = this._isOverviewWindow_bkp;
      this._isOverviewWindow_bkp = null;
    }
  }
}

function init() {
  return new Extension();
}
