const ExtensionUtils = imports.misc.extensionUtils;
const Panel = imports.ui.main.panel;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Config = imports.misc.config;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;


/** Const
 */

const SETTINGS_ID = 'org.gnome.shell.extensions.tp_batterysaver';

const NOTHR = 100;
const BAT0_END_FILE = '/sys/class/power_supply/BAT0/charge_control_end_threshold'
const BAT0_END_CFG = 'bat0-thr-end'


/** Init
 */

function init(meta) {
    return new ThrExtension();
}

/** Extension
 */

class ThrExtension {
    constructor() {
        log('constructor');
    }

    enable() {
        this.ind = new Indicator();

        const aggregateMenu = Panel.statusArea['aggregateMenu'];
        aggregateMenu._power._item.menu.addMenuItem(this.ind.menu, 0);
        aggregateMenu._power._item.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 1);
    }

    disable() {
        this.ind.menu.removeAll();
        this.ind.menu.destroy();
        this.ind.destroy();
        this.ind = null;
    }
}

/** Indicator
 */

var Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.SystemIndicator {
        _init() {
            super._init();

            this.settings = ExtensionUtils.getSettings(SETTINGS_ID);
            this.settings.connect(
                `changed::${BAT0_END_CFG}`,
                () => {
                    this._clearItems();
                    this._refreshItems();
                }
            );

            this.thesholdSubMenu = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this.thesholdSubMenu);
            this._refreshItems();
        }

        _clearItems() {
            this.thesholdSubMenu.removeAll();
        }

        _refreshItems() {
            const bat0_thr = this._getThreshold();
            const bat0_end = this.settings.get_int(BAT0_END_CFG);

            if (bat0_thr != bat0_end && bat0_thr != NOTHR) {
                // manual override or smth
                const overrideItem = new PopupMenu.PopupMenuItem(`Override at ${bat0_thr}%`);
                overrideItem.setOrnament(PopupMenu.Ornament.DOT);
                overrideItem.setSensitive(false);
                this.thesholdSubMenu.addMenuItem(overrideItem);
            }

            [
                [bat0_end, (pct) => `Limit at ${pct}%`],
                [NOTHR, () => 'Full charge']
            ].forEach((el) => {
                let pct = el[0];
                let getLabel = el[1];

                let item = new PopupMenu.PopupMenuItem(getLabel(pct));
                if (pct == bat0_thr) {
                    item.setOrnament(PopupMenu.Ornament.DOT);
                    item.setSensitive(false);
                } else {
                    item.connect('activate', () => this._onChanged(pct));
                }

                this.thesholdSubMenu.addMenuItem(item);
            });
        }

        _onChanged(pct) {
            this._setThreshold(pct, () => {
                this._clearItems();
                this._refreshItems();
            });
        }

        _getThreshold() {
            let [, out, ,] = GLib.spawn_command_line_sync(`cat ${BAT0_END_FILE}`);
            return parseInt(ByteArray.toString(out).trim());
        }

        _setThreshold(thr, callback) {
            try {
                let proc = Gio.Subprocess.new(
                    ['/bin/sh', '-c', `echo ${thr} | pkexec tee ${BAT0_END_FILE}`],
                    Gio.SubprocessFlags.STDERR_PIPE
                );

                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        let [, , stderr] = proc.communicate_utf8_finish(res);
                        if (!proc.get_successful())
                            throw new Error(stderr);
                    } catch (e) {
                        logError(e);
                    } finally {
                        callback();
                    }
                });
            } catch (e) {
                logError(e);
            }
        }
    }
)

