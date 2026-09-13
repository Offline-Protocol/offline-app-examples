Build me an aesthetically pleasing **Tic Tac Toe game** for two nearby players using the **Offline Protocol SDK**.

I want two people with the app open on their phones to be able to discover each other nearby, connect, and play Tic Tac Toe together using Offline Protocol.

Make the app simple, playful, and visually polished.

### Home screen

Start the game with two main options:

**Host Game**

**Join Game**

Make these the primary actions on the home screen with a nice Tic Tac Toe title/logo and subtle animations in the background.

### Host Game

When I choose **Host Game**, make my device available for another nearby player to discover using the Offline Protocol SDK.

Show a waiting screen while looking for someone to join.

Make this screen visually interesting with an animated radar, pulsing circles, floating X and O shapes, or another subtle nearby-device animation.

Show something like:

**Waiting for a player...**

When another player discovers and connects to the host, animate their arrival and show that a player has joined.

Then transition both players into the game.

The host should play as **X** and take the first turn.

### Join Game

When I choose **Join Game**, use the Offline Protocol SDK to scan for nearby hosted games.

Make the scanning experience fun instead of showing a normal loading spinner.

Use an animated radar/scanning effect with expanding circles, a pulse or sweep animation, and text like:

**Looking for nearby games...**

When nearby hosts are discovered, show them on the screen as they appear.

Let me select one of the available hosts and join their game.

Show nice visual states while discovering, connecting, and successfully joining.

Once connected, transition both players into the Tic Tac Toe board.

The joining player should play as **O**.

### Playing the game

Once connected, open the Tic Tac Toe board.

Show both players at the top with their X/O symbol and make it obvious whose turn it is.

When someone makes a move, send it to the other player using the Offline Protocol SDK so both phones always show the same board.

Make placing X and O feel satisfying with small animations. X can draw itself into the square and O can animate around the circle.

Only let the player whose turn it is interact with the board.

Keep track of wins between the two players while they stay connected.

### When someone wins

Make winning fun.

Highlight the three winning squares, animate a line through them, and fire **confetti across the screen**.

Show something like:

**You won! 🎉**

On the other player's phone, show a funny losing animation/graphic instead of confetti. It could be a sad face, broken crown, tiny rain cloud, falling pieces, or another playful animation with something like:

**You lost 😭**

or

**So close!**

Make the win and loss experiences visually different for each player.

For a draw, show a small fun animation with:

**It's a draw 🤝**

### Rematch

After the game, let either player request a rematch.

If one player requests it, show the other player something like:

**Your opponent wants a rematch**

with Accept and Decline.

If accepted, reset the board and start another round while keeping both players connected.

Keep the existing score between the two players across rematches.

Also let either player leave the current game and return to the **Host Game / Join Game** screen.

### Connection experience

Handle things like a player disconnecting or going out of range nicely.

Instead of technical errors, show simple messages such as:

**Opponent disconnected**

and give me the option to wait for them or return to the home screen.

Use the Offline Protocol SDK for nearby discovery and communication between the two players.

Use the actual Offline Protocol SDK APIs available to you rather than making up SDK functions.

Overall, make the game colorful, modern, and fun, with smooth animations, good typography, rounded UI elements, subtle haptics, and satisfying interactions.

The main flows should be:

**Host Game → Wait for Player → Player Joins → Play → Win/Lose/Draw → Rematch**

or

**Join Game → Scan for Games → Select Host → Connect → Play → Win/Lose/Draw → Rematch**
