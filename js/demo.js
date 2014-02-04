require([
      "js/core/classes/emulator"
      , "js/plugins/std.canvas.vga"
      , "js/plugins/std.keyboard"
  ], function (jemul8
      , canvasVGAPlugin
      , keyboardPlugin
  ) { "use strict";
      $(function () {
          var emu = new jemul8( {
              "floppy0.driveType":
                  "FDD_350HD"
                  //"FDD_525HD"
              , "floppy0.diskType":
                  "FLOPPY_1_44"
                  //"FLOPPY_160K"
              , "floppy0.path":
                  //"asm/tests/branch.bin"
                  //"asm/tests/jmp_pt1.bin"
                  //"asm/tests/flags.bin"
                  //"asm/tests/mul_pt1.bin"
                  //"asm/tests/mul_pt2.bin"
                  //"asm/tests/mul_pt3.bin"
                  //"asm/tests/div_pt1.bin"
                  //"asm/tests/div_pt2.bin"
                  //"asm/tests/div_pt3.bin"
                  //"asm/tests/str_pt1.bin"
                  //"asm/boot.img"
                  //"asm/branch_test.bin"
                  //"boot/Xenix386/N1"
                  //"boot/chaOS/chaOS.img"
                  //"boot/nanoos/nanoos-20-march-2010.img"
                  //"boot/nawios/fd.img"
                  "boot/mikeos/mikeos-4.3/disk_images/mikeos.flp"
                  //"boot/MSDOS/Dos5.0.img"
                  //"boot/MSDOS/Dos3.3.img"
                  //"boot/PC-DOS/pcdos11.img"
                  //"boot/MT86/mt86-0.11.9.11.img"
                  //"boot/FreeDOS/fdboot.img"
                  //"boot/lightos/lightos.img"
                  //"boot/odin/FDOEM.144.img"
                  //"boot/memtest/floppy/memtestp.bin"
                  //"boot/kos/kos.img"
                  //"vmware/grub.img"
              , "floppy0.status": true
          } );
          canvasVGAPlugin.applyTo(emu);
          keyboardPlugin.applyTo(emu);

          emu.init(function () {
              $("#reset").click(function ( evt ) {
                  emu.reset();
                  emu.run();
              });
              $("#pause").click(function ( evt ) {
                  emu.pause();
              });
              $("#run").click(function ( evt ) {
                  emu.run();
              });
              /*$("#enter").click(function ( evt ) {
                  //emu.pressKey(0x1C);
                  function pressKey( name ) {
                      var idx = Scancode.getKeyIndex(name);
                      emu.machine.keyboard.keyboard.generateScancode(idx, "make");
                      emu.machine.keyboard.keyboard.generateScancode(idx, "break");
                  }
                  pressKey("KEY_D");
                  pressKey("KEY_I");
                  pressKey("KEY_R");
                  pressKey("KEY_ENTER");
              });*/
              emu.run();
              //alert("Started");
          }, function () {
              // Load failed
              //alert("Load failed");
          });
      });
  });
