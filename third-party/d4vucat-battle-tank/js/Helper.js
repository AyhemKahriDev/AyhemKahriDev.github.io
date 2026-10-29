
/**
 * Remove an element from the array
 * @param arg element to remove
 * @returns
 */
Array.prototype.remove = function(arg){
	var i=0,n=0;
	var arrSize = this.length;
	for(i=0;i<arrSize;i++){
		if(this[i] != arg){
			this[n++]=this[i];
		}
	}
	if(n<i){
		this.length = n;
	}
};

/**
 * Remove an element from the array by index
 * @param index element index
 * @returns
 */
Array.prototype.removeByIndex = function(index){
	var i=0,n=0;
	var arrSize = this.length;
	for(i=0;i<arrSize;i++){
		if(this[i] != this[index]){
			this[n++]=this[i];
		}
	}
	if(n<i){
		this.length = n;
	} 
};

/**
 * Check if the array contains an element
 * @param arg element to find
 * @returns
 */
Array.prototype.contain = function(arg){
	var i=0;
	var arrSize = this.length;
	for(i=0;i<arrSize;i++){
		if(this[i] == arg){
			return true;
		}
	}
	return false;
};
