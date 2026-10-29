$( document ).ready( function(){
	var flag = false, winner;

	function init_game(){
		flag = false;
		$( '#start_game' ).text( 'Start' )
		$('td').text('')
		$( '#tt_board' ).show();
		$( '#winner_text' ).text('');
		$( '#winner' ).hide();
	}
	$( '#play_again' ).click(function(){
		init_game();
	});
	$( '#start_game' ).click( function(){
		init_game();
	});
	$( 'td' ).click(function(){
		$( '#start_game' ).text( 'Restart' )
		if ( $(this).text()=="" ) {
			$(this).text('X')
		}
		else{
			$(this).text('')
		}
		check();
	});

	$('td').contextmenu(function(){
		$( '#start_game' ).text('Restart')
		if ( $(this).text()=="" ) {
			$(this).text('O')
		}
		else{
			$(this).text('')
		}
		check();
		return false;
	});

	arr = new Array();
	function check(){
		for ( i=1; i<=3 ; i++ ){
			arr[i] = new Array();
			for ( j=1; j<=3 ; j++ ){
				element_id = '#c_'+i+'_'+j;
				arr[i][j] = $( element_id ).text();
			}
		}
		for ( i=1; i<=3 ; i++ ){
			if( arr[i][1] != '' && arr[i][1] == arr[i][2] && arr[i][2] == arr[i][3] ){
				flag = true;
				winner = arr[i][1];
			}
			else if( arr[1][i] != '' && arr[1][i] == arr[2][i] && arr[2][i] == arr[3][i] ){
				flag = true;
				winner = arr[1][i];
			}
			else if( arr[2][2] != "" ) {
				if ( arr[1][1] == arr[2][2] && arr[2][2] == arr[3][3] ) {
					flag = true;
					winner = arr[2][2];			
				}
				else if ( arr[1][3] == arr[2][2] && arr[2][2] == arr[3][1] ) {
					flag = true;
					winner = arr[2][2];			
				}
			}
		}
		if ( flag ) {
			$( '#tt_board' ).hide();
			$( '#winner_text' ).html('<h2>Winner is: <span class="h1 text-bold">'+winner+'</span></h2>')
			$( '#winner' ).show();
		}
	}
});