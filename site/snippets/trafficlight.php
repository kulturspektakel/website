
<?php
    if (gmdate("c") > '2021-07-23' && gmdate("c") < '2021-07-26') {
        echo "<h4>Aktuelle Kapazität</h4>";
    
        $query = file_get_contents('https://api.kulturspektakel.de/graphql?query=query%7Bareas%7BdisplayName%20openingHour%7BstartTime%20endTime%7DavailableTables%7DavailableCapacity%7D');
        $data = json_decode($query, true);
    
        $at_capacity = $data['data']['availableCapacity'] < 1;
        $close_to_capacity = $data['data']['availableCapacity'] < 50;
    
        foreach ($data['data']['areas'] as $area) {
    
            $is_open = false;
            foreach ($area['openingHour'] as $hour) {
                $c = gmdate("c");
                if ($hour['startTime'] < $c && $hour['endTime'] > $c) {
                    $is_open = true;
                    break;
                }
            }
    
            if (!$is_open) {
                echo "⚪️ <strong>".$area['displayName'].":</strong> Nicht geöffnet<br />";
            } else if ($at_capacity || $area['availableTables'] < 1) {
                echo "🔴 <strong>".$area['displayName'].":</strong> Keine freien Plätze<br />";
            } else if ($close_to_capacity || $area['availableTables'] < 4) {
                echo "🟡 <strong>".$area['displayName'].":</strong> Wenige freie Plätze<br />";
            } else {
                echo "🟢 <strong>".$area['displayName'].":</strong> Plätze verfügbar<br />";
            }
        }
    }
?>