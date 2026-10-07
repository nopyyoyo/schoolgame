I want to create a new game into /small-games. The access point is from player page next to the current letter-maze game. Use layered\_map\_15x40 as game background. For this game I want the player character to be auto walk up all the time. The actual control from user is only for left-right movement and there are only 3 fixed position which user can move around.



1\. Left position. It is in the middle of pixel 3 and 4 from the left

2\. Center position. It is at pixel 8 from the left

3\. Right position. It is in the middle of pixel 12 and 13 from the left



Two way to move the player character

1\. Use on screen arrow icon at the top of the screen. 3 arrow icons on each column position

2\. User can use touch screen. Any point from column pixel 1-5 is left position. 6-10 is center position. 11-15 is right position



when position change. Player character will move left or right in addition of the auto walking up. Face the player character turn left or right accordingly. It should move left-right at the same speed as auto walking up. If it hit the block tile along the way it consider that player cannot change position successfully and it should turn back to another position in the direction that it came from.



Even though I said player is auto walking up but actually I want player position to stay at the bottom of the screen. Instead, the background will be moving down so it looks like player walking up. The background is loop. One set of background consider as one checkpoint and player need to pass 10 checkpoints in order to win the game.



The game start by counting down 3 to 1 then the background start to move

Each checkpoint start by randomly pick one sound file inside /object\_sound. That one will be the correct answer. Then at the top of the screen show 3 Thai word, one for each position. Randomly assign the correct answer to one position, the other two randomly choose from the rest inside the folder.

Play the sound of the correct answer. At the same time, zoom in at the center of the screen the equivalent file name in /object\_photo and fade it out.

Ideally the sound and the photo should be done when player charactor arrive pixel 20 from the bottom. allow them to decide which position they should go through before they come into pixel 27 where there are block pixel between 3 positions



Enemy charactor will be spawn around pixel 37 on each position except the correct position. It keep the column  position lock on user and as the block tiles prevent them to move to the other position, basically it is unavoidable dead.



If player pass the first checkpoint. Loop into the second, third, ... until 10 with the same logic for each loop. Keep The background continue seamlessly.



When player pass 10th checkpoint. Continue the background use layered\_map\_15x20. Update status of the game to pass for that player and enable them to collect the prize in their player page (this is the same as in letter-maze game). Play the 106 Fanfare sound. Now user can't control the character anymore. Automatic walk the character toward pixel column 7 continue walking up until arrive pixel 12 from the bottom and turn their face around.

