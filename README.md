# vscode-sing

visual studio code plugin for the [sing language](https://mdegirolami.wixsite.com/singlang).

Compiler repository at <https://github.com/mdegirolami/sing>

Plugin repository at <https://github.com/mdegirolami/vscode-sing>

This is the very first release of the compiler and plugin so please, if you find some bug (you are very likely to), file an issue on
<https://github.com/mdegirolami/vscode-sing/issues>

Thank in advance for your patience.

gcc libraries versions
======================
The libraries have been compiled:

On windows with mingw 8.1

On Linux with gcc 9.4

I have checked the libraries with a couple of older compilers, and they look backward compatible. Let me know if you encounter any problem.

Features
========
This version offers:
- a ninja file generator for hybrid c++/sing projects
- the sing compiler
- syntax highlighting
- on the fly error checking in the editor
- auto-completion on
  - class members
  - enum cases
  - extern items
  - embedded functions
  - inclusion paths
  - named arguments
- signature provider (suggests function arguments)
- definition provider (find your definitions with F12)
- symbols provider (ctl-shift-O to bring up a list of all the symbols in a file)

I'm sorry there is currently no sing Debugger. You need to debug the c++ generated from the sing compiler.


