# Poker Bluff

A shared vocabulary for the multiplayer bluffing card game.

## Language

**Lobby**:
The waiting room where players gather before a match. Every player must mark themselves ready before the match begins.

**Match**:
A complete game in which players begin with four cards and are eliminated when their card allowance reaches zero.

**Card allowance**:
The number of cards a player receives when hands are dealt. Losing a challenge reduces the loser's allowance by one.
_Avoid_: Score, chips, health

**Hand**:
The private cards dealt to one player.

**Combined cards**:
All active players' hands considered together. Bids and challenges are judged against these cards, regardless of suit.

**Bid**:
A player's claim that a particular combination exists among the combined cards. It must be higher than the preceding bid.
_Avoid_: Bet

**Round**:
One deal of private hands, followed by increasing bids until a challenge causes a reveal. Hands stay fixed during a round.

**Turn**:
One active player's opportunity to bid. Turns follow seat order; a new round begins with the next surviving player after the preceding round's final bidder.

**Combination**:
A single, pair, triple, full house, or four of a kind, in increasing strength. Ranks run from 2 to Ace; full houses compare their triple rank before their pair rank.

**Bluff challenge**:
A claim that another player's bid does not exist among the combined cards. If correct, the bidder loses a card; otherwise, the challenger loses a card.

**High Card challenge**:
A claim that another player's bid is the highest permitted combination among the combined cards. If correct, the bidder loses a card; otherwise, the challenger loses a card.
_Avoid_: High-card hand

**Reveal**:
The showing of all hands to settle a challenge.

**Spectator**:
An eliminated player who can continue watching the match.
