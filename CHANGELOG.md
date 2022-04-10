## 0.41.0
* Now the compiler analyzes the code and tries to determine if dereferenced pointers may be null. If so, the programmer is asked to put an explicit check to rule out a null pointer dereference. The analisys is performed only on local variables and input arguments. As a side effect, starting from this version only local pointers and input argument pointers can be dereferenced.
With this modification sing makes a further step toward safety making impossible for any sing program to dereference a null pointer.

* Now the compiler analyzes the code and tries to determine if integer divisors may be null. If so, the programmer is asked to put an explicit check to rule out a division by 0. The analisys is performed only on local variables and input arguments. As a side effect, starting from this version only local variables and input arguments can be used as divisors in an integer division.
With this modification sing makes a further step toward safety making impossible for any sing program to cause a zero division exeception.

* classes with a finalize() member are no more copyable. They are supposed to wrap some resource and copying the class would cause it to be released twice.

* new function in the string library:
	~~~
	public fn toCp(src string) i32;
	~~~
	the function returns the codepoint of the first character of a string. It is meant to make it easyer to compare a codepoint like in:
	~~~
	if (xx == str.toCp("a")) ...
	~~~
* Fix: the this pointer was not handled correctly.

## 0.40.3
* Fix updater: used to add the sdk path to c_cpp_properties.json even if already present.
* Fix: insertion of a string in a vector didn't work.

## 0.40.2
* Fix command 'clean debug'.

## 0.40.1
* Updated link options to cope with gcc defaulting to 'position undependent code' starting from Ubunto 17.04.

## 0.40.0
* First release.
