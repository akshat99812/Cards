import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import userRouter from "./user";

const router = express.Router()

const app = express();
const server = createServer(app);
app.use(cors());
app.use(express.json());

// app.use("/user", userRouter);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// Player queue and room configuration
const queues:{[key:string]:any} = {
    3: [],
    4: [],
    5: [],
    6: []
};
//const ROOM_SIZE = 4; // Adjust the number to your room capacity

const rooms: { [roomId: string]: any } = {}; // Keep track of rooms and lastPlayed data

const getAllRooms = () => {
    const rooms = Array.from(io.sockets.adapter.rooms.keys()); // Get all room IDs
    const filteredRooms = rooms.filter(room => !io.sockets.adapter.sids.has(room)); // Filter out individual sockets
    return filteredRooms;
};

// When a user connects
io.on('connection', (socket) => {
    console.log('A player connected: ' + socket.id);

    // Handle joining a queue based on room size
    socket.on('join-queue', (roomSize: 3 | 4 | 5 | 6) => {
        if (queues[roomSize]) {
            queues[roomSize].push(socket.id);
            console.log(`Player ${socket.id} added to queue for room size ${roomSize}. Current queue: ${queues[roomSize]}`);

            // Check if the queue has enough players to form a room
            if (queues[roomSize].length >= roomSize) {
                const roomId = `room-${Math.random().toString(36).substring(2, 10)}`; // Generate random room id
                const leaderId = queues[roomSize][0];                        // Set the leaderId to the first player in the queue
                const playersInRoom = queues[roomSize].splice(0, roomSize); // Remove players from queue

                // Add players to the room and notify them
                playersInRoom.forEach((playerId: string) => {
                    const playerSocket = io.sockets.sockets.get(playerId);
                    if (playerSocket) {
                        playerSocket.join(roomId);
                        playerSocket.emit('room-joined', { roomId, players: playersInRoom , leaderId , playerId});
                        console.log(`Player ${playerId} added to room ${roomId}`);
                    }
                });

                console.log(`Leader ${leaderId} added to room ${roomId}`);

                //emit the leader id to all players in the room
                //io.to(roomId).emit('leader-joined', { roomId, leaderId });

                io.to(roomId).emit('start-game', `Game started in room: ${roomId} with ${roomSize} players` );
            }
        } else {
            console.error(`Invalid room size: ${roomSize}`);
        }
    });

    // Handle player disconnection
    // socket.on('disconnect', () => {
    //     console.log(`Player disconnected: ${socket.id}`);
    //     // Remove player from all queues
    //     for (const size in queues) {
    //         const index = queues[size].indexOf(socket.id);
    //         if (index !== -1) {
    //             queues[size].splice(index, 1);
    //             console.log(`Player ${socket.id} removed from queue for room size ${size}. Current queue: ${queues[size]}`);
    //         }
    //     }
    // });

    // socket.on('disconnect', () => {
    //     console.log(`Player disconnected: ${socket.id}`);
    // });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
    
        // Check if player was in a room and handle accordingly
        // e.g., check for roomId in rooms object and remove player from room
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.indexOf(socket.id);
            if (playerIndex > -1) {
                room.players.splice(playerIndex, 1); // Remove player from the room
                console.log(`Player ${socket.id} removed from room ${roomId}`);
            }
    
            // If the room is now empty, handle room deletion manually
            if (room.players.length === 0) {
                delete rooms[roomId];
                console.log(`Room ${roomId} deleted because it's empty`);
            }
        }
    });
    


    //starting game and distributing cards
    socket.on('start-game', () => {

    })

    socket.on('queue-submit', (data) => {
        console.log('Received queue submit:', data);
    
        // Emit to only players in the specific room
        io.to(data.roomId).emit('queue-submit', {
          queueId: data.queueId,
          queueValue: data.queueValue,
        });
      });

      // Handle when a user joins a room
      socket.on('joinRoom', (roomId) => {
        socket.join(roomId); // Make the player join the room
        console.log(`Player ${socket.id} joined room ${roomId}`);
    });


      socket.on('playCard', (data) => {
        let { roomId, player, card } = data;
    
        // If the roomId has the 'room-' prefix, remove it
        // if (roomId.startsWith('room-')) {
        //     roomId = roomId.replace('room-', ''); // Extract the actual roomId
        // }
    
        // Broadcast to everyone in the room except the sender
        socket.to(roomId).emit('lastPlayed', { player, card });
    
        console.log(`Player ${player} played ${card} in room ${roomId}`);
        console.log('All rooms:', getAllRooms());
    
        const room = io.sockets.adapter.rooms.get(roomId);
    
        if (room) {
            room.forEach((socketId) => {
                io.to(socketId).emit("lastPlayed", { player, card });
                console.log(`Player ${player} played ${card} in room ${roomId}`);
            });
        } else {
            console.log(`Room ${roomId} not found`);
        }
    });
    
});
// Basic route to check server status
app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');

});

const cards = [1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52];

app.post('/getCards',(req:any,res:any)=>{
 
    const shuffleCards=(array:number[])=>{
        for (var i = array.length - 1; i >= 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    const sC=shuffleCards(cards);

    const {roomSize,roomId} = req.body;

    if (!roomSize || roomSize <= 0) {
        return res.status(400).send("Invalid room size");
    }

    const shuffledCards = shuffleCards(cards);

    // Calculate how many cards each player should get
    const cardsPerPlayer = Math.floor(shuffledCards.length / roomSize);
    const playerCards: any[] = [];

    // Distribute the cards equally among players
    for (let i = 0; i < roomSize; i++) {
        playerCards.push(shuffledCards.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer));
    }

    // If there are remaining cards (due to unequal division), distribute the extra cards
    const remainingCards = shuffledCards.slice(roomSize * cardsPerPlayer);
    for (let i = 0; i < remainingCards.length; i++) {
        playerCards[i].push(remainingCards[i]);
    }
    
    //sendingplayer cards to the leader of the room
    res.send(playerCards);

    const room = io.sockets.adapter.rooms.get(roomId);

    if (room) {
        let i = 0;  // This will track the player index for card assignment

        room.forEach((socketId) => {
            // Make sure we have a card set for each player
            if (i < playerCards.length) {
                // Send the respective player's card set to that player
                io.to(socketId).emit('cardsDistributed', playerCards[i]);

                console.log(`Distributed cards to player ${i}:`, playerCards[i]);
                i++;  // Move to the next player's card set
            }
        });
    } else {
        console.error('Room not found');
    }
    
    //sending all their cards
   // io.in(roomId).emit("cardsDistributed", playerCards);
})


// Start the server
server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});

