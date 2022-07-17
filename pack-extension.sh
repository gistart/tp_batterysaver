#!/bin/bash

# compile schema
glib-compile-schemas schemas/

# pack extension
gnome-extensions pack -f .

# install extension
gnome-extensions install ./tp_batterysaver@gistart.shell-extension.zip --force

# test settings
# gnome-extensions prefs tp_batterysaver@gistart
