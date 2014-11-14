<?php
	echo shell_exec("rm -rf ./site/cache/*"); 
	echo shell_exec("git pull");
?>