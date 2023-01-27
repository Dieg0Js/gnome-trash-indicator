/*
 * By @Dieg0Js - 2023
 * https://github.com/Dieg0Js/gnome-trash-indicator
 *
 * Fork of Gnome Trash from Axel von Bertoldi
 * https://gitlab.com/bertoldia/gnome-shell-trash-extension
 *
 * Copyright 2011 - 2019 Axel von Bertoldi
 * Copyright 2019 by pcm720 (GNOME 3.32/ES6-compatible classes)
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program; if not, write to:
 * The Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor
 * Boston, MA 02110-1301, USA.
 */

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext.domain("gnome_trash_indicator");
const _ = Gettext.gettext;
const { St, GObject, Gio, GLib } = imports.gi;
const ByteArray = imports.byteArray;

const ScrollableMenu = class ScrollableMenu extends PopupMenu.PopupMenuSection {
  constructor() {
    super();
    let scrollView = new St.ScrollView({
      y_align: St.Align.START,
      overlay_scrollbars: true,
      style_class: 'vfade'
    });
    this.innerMenu = new PopupMenu.PopupMenuSection();
    scrollView.add_actor(this.innerMenu.actor);
    this.actor.add_actor(scrollView);
  }

  addMenuItem(item) {
    this.innerMenu.addMenuItem(item);
  }

  removeAll() {
    this.innerMenu.removeAll();
  }
};


const ActionBar = GObject.registerClass(
class ActionBar extends PopupMenu.PopupBaseMenuItem {
    constructor(openDirecoryCallback, emptyDirecoryCallback) {
      super({
          reactive: false,
          activate: false,
          hover: false,
          can_focus: false,
          style_class: 'action-bar',
      });
      let actionsBox = new St.BoxLayout({
          vertical: false,
          hover: false,
          can_focus: false,
      });
      //OPEN BUTTON

      this._openBtn = new PopupMenu.PopupBaseMenuItem({
        style_class: 'action-bar-btn'
    });
    // let openDirecoryIcon = new St.Icon({
    //     icon_name: "folder-open-symbolic",
    //     style_class: 'popup-menu-icon',
    // });
    // this._openBtn.add_child(openDirecoryIcon);
    let openLbl = new St.Label({ text: _("Open") });
      this._openBtn.add_child(openLbl);
    this._openBtn._ornamentLabel.visible = false;
    this._openBtn.connect('activate', openDirecoryCallback);

    actionsBox.add(this._openBtn);
    this.actor.add_actor(actionsBox);

      //CLEAR BUTTON

      this._clearBtn = new PopupMenu.PopupBaseMenuItem({
          style_class: 'action-bar-btn'
      });
      // let clearIcon = new St.Icon({
      //     icon_name: "edit-delete-symbolic",
      //     style_class: 'popup-menu-icon',
      // });
      // this._clearBtn.add_child(clearIcon);
      let clearLbl = new St.Label({ text: _("Empty") });
        this._clearBtn.add_child(clearLbl);
      this._clearBtn._ornamentLabel.visible = false;
      this._clearBtn.connect('activate', emptyDirecoryCallback);
      actionsBox.add(this._clearBtn);
      
    }
  }
);

const TrashMenuItem = GObject.registerClass(
  class TrashMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(text, icon_name, gicon, onActivate, onIconPress) {
      super._init(0.0, text);

      let icon_cfg = { style_class: 'popup-menu-icon' };
      if (icon_name != null) {
        icon_cfg.icon_name = icon_name;
      } else if (gicon != null) {
        icon_cfg.gicon = gicon;
      }

      this.icon = new St.Icon(icon_cfg);
      this.actor.add_child(this.icon);
      this.label = new St.Label({ text: text });
      this.actor.add_child(this.label);

      this.connect('activate', onActivate);

      let removeIcon = new St.Icon({
        icon_name: "window-close-symbolic",
        style_class: 'popup-menu-icon'
    });
    let removeBtn = new St.Button({
        style_class: 'action-btn',
        child: removeIcon
    });
    removeBtn.set_x_align(Clutter.ActorAlign.END);
    removeBtn.set_x_expand(true);
    removeBtn.set_y_expand(true);
    this.actor.add_child(removeBtn);
    removeBtn.connect('button-press-event', onIconPress);
    }

    destroy() {
      super.destroy();
    }
  });

const TrashMenu = GObject.registerClass(
  class TrashMenu extends PanelMenu.Button {
    _init() {
      super._init(0.0, _("Trash"));
      this.trashIcon = new St.Icon({
        icon_name: 'user-trash-symbolic',
        style_class: 'popup-menu-icon'
      })
      this.add_actor(this.trashIcon);

      // If this fails, see workaround in https://bugs.archlinux.org/task/62860
     //  this.trash_path = 'trash:///';
      let trashPath = GLib.get_home_dir() + '/.local/share/Trash/';
      this.localTrashPath = ".local/share/Trash/";

      this.trash_files_folder = Gio.file_new_for_uri('file:///' + trashPath + 'files/');
      this.trash_info_files_folder = Gio.file_new_for_uri('file:///' + trashPath + 'info/');
     
 
      this._addConstMenuItems(); 
      this._onTrashChange();
      this._setupWatch();
    }

    _addConstMenuItems() {

      this.filesList = new ScrollableMenu();
      this.menu.addMenuItem(this.filesList);

      this.separator = new PopupMenu.PopupSeparatorMenuItem();
      this.menu.addMenuItem(this.separator); 

      this.actionBar = new ActionBar(
        this._onOpenTrash.bind(this),
        this._onEmptyTrash.bind(this));
      this.menu.addMenuItem(this.actionBar);    
    }

    destroy() {
      super.destroy();
    }

    _onOpenTrash() {
      Gio.app_info_launch_default_for_uri(this.trashPath, null);
    }

    _setupWatch() {
      this.monitor = this.trash_files_folder.monitor_directory(0, null);
      this.monitor.connect('changed', this._onTrashChange.bind(this));
    }

    _onTrashChange() {
      this._clearMenu();
      if (this._listFilesInTrash() == 0) {
        this.visible = false;
      } else {
        this.show();
        this.visible = true;
      }
    }

    _onEmptyTrash() {
     new InteractiveDialog("Empty Trash?",
     "All the files are going to be deleted permanently",
     this._doEmptyTrash.bind(this)
     ).open();

    }

    _doEmptyTrash() {
     let children = this.trash_files_folder.enumerate_children('*', 0, null);
 
     let file_info = null;
     while ((file_info = children.next_file(null)) != null) {
       let file_name = file_info.get_name();
       let _file_path = this.localTrashPath + "files/" + file_name;
     let _info_path = this.localTrashPath + "info/" + file_name + ".trashinfo";

       if (this._deleteFileFromPath(_file_path)){
         //delete .trashinfo file only if actual file is deleted correctly
         this._deleteFileFromPath(_info_path);
       }
     }

    }

    _onDeleteSingleTrashFile(file_name) {
     this.file_name = file_name;
     new InteractiveDialog("Delete " + file_name + "?",
     "The file is going to be deleted permanently",
     this._doDeleteSingleTrashFile.bind(this)
     ).open();
    }

    _doDeleteSingleTrashFile() {
     log("deleting file: " + this.file_name);
     let _file_path = this.localTrashPath + "files/" + this.file_name;
     let _info_path = this.localTrashPath + "info/" + this.file_name + ".trashinfo";
     if (this._deleteFileFromPath(_file_path)){
       //delete .trashinfo file only if actual file is deleted correctly
       this._deleteFileFromPath(_info_path);
     }
    }




    _deleteFileFromPath(filePath) {
     //delete a file or a directory and its content recursively 
     // return true in case of success

     //define new gio file from path
     let file = Gio.File.new_for_path(filePath);

     //get file type and check if is a directory
       let fileType = file.query_file_type(Gio.FileQueryInfoFlags.NONE, null);
       if (fileType == Gio.FileType.DIRECTORY) {

         //enumarate all directory children
           let currentDirecoryChildren = file.enumerate_children('*',
                                               Gio.FileQueryInfoFlags.NONE, null);
           //current child info
           let child, childType, childPath, childFile;

           //loop through all directory children
           while ((child = currentDirecoryChildren.next_file(null)) != null) {
               //get current child path
               childPath = filePath + '/' + child.get_name();

               //get file type and check if is a directory
               childType = child.get_file_type();
               
               if (childType == Gio.FileType.DIRECTORY) {
                   //recursively call this fuction if is a directory to delete all children
                   if(!this._deleteFileFromPath(childPath)){
                       return false;
                   }
               } else {
                   //delete child if is a file
                   childFile = Gio.File.new_for_path(childPath);                    
                   if(!childFile.delete(null)){
                       return false;
                   }
               }
           }
           //delete folder after deleting all children
           return file.delete(null);
       } else {
           //delete file directly <is not a directory>
           return file.delete(null);
       }
   }

    _listFilesInTrash() {
      let children = this.trash_files_folder.enumerate_children('*', 0, null);
      let count = 0;
      let file_info = null;
      while ((file_info = children.next_file(null)) != null) {
        let file_name = file_info.get_name();

       //  read info file to get restore path and delete date
       let info_path = this.trash_info_files_folder.get_path() + "/" + file_name + ".trashinfo";
               let [ok, info] = GLib.file_get_contents(info_path);
               if (!ok) {
                   log.error(`unable to get contents of ${info_path}`);
                   continue;
               }
               let lines = ByteArray.toString(info).split('\n');
               if (lines[0] != '[Trash Info]') {
                   log.error(`invalid contents of ${info_path}`);
               }
               let restore_path = lines[1].split('=')[1];
               let delete_date = lines[2].split('=')[1];
               
        let item = new TrashMenuItem(file_info.get_display_name(),
          null,
          file_info.get_symbolic_icon(),
          () => {
            this._onRestoreTrashFile(file_name, restore_path, delete_date);
          },
          () => {
            this._onDeleteSingleTrashFile(file_name);
          });
          
        this.filesList.addMenuItem(item);
        count++;
      }
      children.close(null)     
      return count;
    }

    _clearMenu() {
      this.filesList.removeAll();
    }

    _onRestoreTrashFile(file_name, restore_path, delete_date) {
     this.file_name = file_name;
     this.restore_path = restore_path.substring(1, restore_path.lastIndexOf("/") + 1);
     //fate is stored in .trashinfo file, read in this._listFilesInTrash() fn.
     //date format is MM-DD-YYYYThh:mm:ss
     let formatted_date = delete_date.split('T');

     new InteractiveDialog(
     "Restore " + file_name + "?",
     "Restore to: " + this.restore_path + "\n\nDeleted on: " + formatted_date[0] + " at " + formatted_date[1],
     this._doRestoreTrashFile.bind(this)
     ).open();
   }

    _doRestoreTrashFile() {
     
     let trashedFile = Gio.File.new_for_path(this.trash_files_folder.get_path() + "/" + this.file_name);
     let destDir = Gio.File.new_for_path(this.restore_path);
     let _originalFile =  Gio.File.new_for_path(this.restore_path + this.file_name);
     
     //check if file already exist - prevent overwriting
     if (!_originalFile.query_exists(null)){
     
     // Create parent directories
     if (!destDir.query_exists(null)) {
       destDir.make_directory_with_parents(null);
     }
 
     // Move file to destination directory
     if (trashedFile.query_exists(null)) {

       //move file using gio lib - not working (?)
       let _isRestored = trashedFile.move(_originalFile, Gio.FileCopyFlags.OVERWRITE, null, null);

       //delete trashinfo after restoring
       if (_isRestored) {
        let _trashinfo_file = Gio.File.new_for_path(this.trash_info_files_folder.get_path() + "/" + this.file_name + ".trashinfo");
        _trashinfo_file.delete(null);
       }

       //open parent folder in file manager wher restoring a file
       Gio.app_info_launch_default_for_uri(destDir.get_uri(), null);

       //or just notify the user
       // Main.notify(_("Operation Success"), _(this.file_name + " correctly restored to " + this.restore_path));

     } else {
       Main.notify(_("File not found"), _(trashedFile.get_path() + " not found"));
     }
   } else {
     Main.notify(_("File already exist"), _(_originalFile.get_path()));
     Gio.app_info_launch_default_for_uri(destDir.get_uri(), null);
   }

    }

  });

   var InteractiveDialog = GObject.registerClass(
     class InteractiveDialogView extends ModalDialog.ModalDialog {
       _init(title, description, action) {
         super._init({ styleClass: null });
   
         let mainContentBox = new St.BoxLayout({
           style_class: `polkit-dialog-main-layout`,
           vertical: false
         });
         this.contentLayout.add_child(mainContentBox/*, { x_fill: true, y_fill: true }*/);
   
         let messageBox = new St.BoxLayout({
           style_class: `polkit-dialog-message-layout`,
           vertical: true
         });
         mainContentBox.add_child(messageBox/*, { y_align: St.Align.START }*/);
   
         this._subjectLabel = new St.Label({
           style_class: `polkit-dialog-headline`,
           style: `text-align: center; font-size: 1.6em; padding-bottom:1em`,
           text: _(title)
         });
   
         messageBox.add_child(this._subjectLabel/*, { y_fill: false, y_align: St.Align.START }*/);
         this._descriptionLabel = new St.Label({
           style_class: `polkit-dialog-description`,
           style: `text-align: center`,
           text: _(description)
         });
   
         messageBox.add_child(this._descriptionLabel/*, { y_fill: true, y_align: St.Align.START }*/);
   
         this.setButtons([
           {
             label: _("Cancel"),
             action: () => {
               this.close();
             },
             key: Clutter.Escape
           },
           {
             label: _("Confirm"),
             action: () => {
               this.close();
               action();
             }
           }
         ]);
       }
     });

function init(extensionMeta) {
  ExtensionUtils.initTranslations("gnome_trash_indicator");
}

let _indicator;

function enable() {
  _indicator = new TrashMenu();
  Main.panel.addToStatusArea('trash_indicator_button', _indicator);
}

function disable() {
  _indicator.destroy();
  _indicator = null;
}

