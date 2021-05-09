require('dotenv').config({path: "./configs/.env"});
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const cookieSession = require('cookie-session');
const socketio = require('socket.io')
const http = require('http')
const bcrypt = require('bcrypt')

const User = require("./models/user.model")
const Post = require("./models/post.model")
const Comment = require("./models/comment.model")

const { cloudinary } = require("./configs/cloudinary.setup")

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 4000;

app.set('views', './views')
app.set('view engine', 'pug');


app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}))

// cookieSession before passport init
app.use(cookieSession({
    maxAge: 24 * 60 * 60 * 1000, // milisec
    keys: [process.env.COOKIE_SESSION_KEY]
}))
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DATABASE_URL, {
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
})
    .then(() => console.log(`Server connected to database`))
const homeRoute = require('./routes/home.route');

app.use("/", homeRoute);

const io = socketio(server, {
    cors: {
      origin: 'http://localhost:3000',
    }
});

// auth for socket 
io.use(async (socket, next) => {
    // client should add userId into socket.auth 
    try {
        
        const userId = socket.handshake.auth.userId;
        if (!userId) throw new Error("Unauthorization connection")
    
        const user = await User.findById(userId).exec()
        if(!user) throw new Error("No one match your id")

        socket.user = user;
        next();
        
    } catch (error) {
        next(error)
    }
})


io.on("connection", socket => {
    // console.log("new socket connection");

    // User update socketId
    const { userId } = socket.handshake.auth;
    User.findByIdAndUpdate( userId, { socketId: socket.id }, { new: true })
        // .then(user => console.log(`update socketId ${user.socketId}`));

    
    Post.find({}).sort({ "createdAt": -1 }).skip(0).limit(5)
    .populate('owner')
    .populate('belongToGroup')
    .exec()
    .then(async posts => {
            
        console.log("send posts to client")
        socket.emit("server-init-post", { posts })
    
    })
    .catch(error => {
        console.log(error.message)
        socket.emit("server-init-post", { error })
        socket.emit("server-send-error", { error: { message : "Can not fetch posts! Something wrong, plz contact developer" } })
    })

    /////////////////////////////////////// init comment per post 
    socket.on("client-req-cmt", async data => {
        console.log("client: "+data.postId)
        try {
            const { postId } = data
            const skip = data.skip || 0
            const limit = 5
            const comments = await Comment.find({ belongToPost : postId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("owner")
            
            // console.log("cmt", comments)

            socket.emit("server-send-comment-list", { comments, postId })
        } catch (error) {
            console.log(error)
            socket.emit("server-send-comment-list", { error, postId: data.postId })
        }
    })
    //////////////////////////////////////////////////////////////////////////



    /////////////////////////////////////// fetch more post
    socket.on("client-fetch-more-post", async ({skip}) => {
        try {
            const posts = await Post.find({})
            .sort({"createdAt" : -1})
            .skip(skip)
            .limit(5)
            .populate("owner")
            .populate("belongToGroup")
    
            socket.emit("server-send-more-post", { posts })
            
        } catch (error) {
            socket.emit("server-send-more-post", {error : { message : "Can not show more post! error " }})
            socket.emit("server-send-error", {error : { message : "Can not show more post! error " }})
        }
    })
    ////////////////////////////////////////////////////////////////////////////

    // new post 
    socket.on("client-make-post", async ({ content, fileList, belongToGroup, owner, }) => {
        
        // console.log(`get client-make-post`);
        // console.log({ content, fileList, belongToGroup, owner, });
        
        try {
            let filedLoaded = await Promise.all([...fileList.map(async (base64) => {
                // upload image to cloudinary with based-64 image
                return await cloudinary.uploader.upload(base64);
            })])
            
            // console.log("file loaded", filedLoaded.map(file => file.url))
            filedLoaded = filedLoaded.map(file => file.url)
            const post = {
                owner,
                content,
                belongToGroup,
                image: [...filedLoaded],
                createdAt : Date.now()
            }

            const tempPost = new Post(post)
            await tempPost.save()
            await tempPost.populate("owner").populate("belongToGroup").execPopulate()
            console.log("server created new post")
            io.emit("server-send-new-post", { post: tempPost})
            io.emit("server-send-noti", { mess : `${tempPost.owner.name} đăng 1 bài viết` })
            
            // delete post no image - use for test
            // await Post.deleteMany({})


        } catch (error) {
            console.log(error.message)
            socket.emit("server-send-error", { error: { message : "You can not post right now! Plz contact developer" }})
        }

    })

    socket.on("client-react-post", async ({ id, user, reaction, }) => {

        console.log("react-post ", reaction, id, "user ", user)

        try {
            
            let foundPost = await Post.findById(id).exec()
            const reacted = foundPost[reaction].includes(user)
            let liked = foundPost.likes.indexOf(user) != -1
            let disliked = foundPost.dislikes.indexOf(user) != -1

            // xoa user trong like  va  xoa user trong dislike 
            let post = await Post.findOneAndUpdate({ _id : id}, { 
                $pull : {
                    likes : user,
                    dislikes : user
                }

            }, { new : true }).exec()

           
            if( 
                ( !liked && !disliked ) ||                  // neu user chua like va chua dislike thi them react
                (liked  && reaction == "dislikes") ||       // neu user da liked va muon dislike  thi them react
                (disliked  && reaction == "likes")          // neu user da disliked va muon like  thi them react
            ){
                
                post[reaction].push(user)
                await post.save()

            } else if(liked  && reaction == "likes") {
                post = await Post.findOneAndUpdate({ _id : id}, { 
                    $pull : {
                        likes : user
                    }
                }, { new : true }).exec()
            } else if(disliked  && reaction == "dislikes") {
                post = await Post.findOneAndUpdate({ _id : id}, { 
                    $pull : {
                        dislikes : user
                    }
                }, { new : true }).exec()
            } 
            


            await post.populate("owner").populate("belongToGroup").execPopulate()
            console.log("update ok")
            io.emit("server-send-react-post", { error: null, post, postId: id})


        } catch (error) {
            console.log("update fail", error.message)
            io.emit("server-send-react-post", { error, postId: id})
        }

    })

    socket.on("client-comment-post", async ({ owner, content, belongToPost }) => {
        console.log("comment feature")
        console.log("get from client ", owner, content, belongToPost)
        try {
            const comment = await Comment.create({ content, owner, belongToPost, createdAt: Date.now()})
            await comment.populate("owner").execPopulate()
            io.emit("server-send-comment-post", { comment , belongToPost })
            // await Comment.deleteMany({}).exec()
        } catch (error) {
            console.log(error)
            io.emit("server-send-comment-post", { error, belongToPost })            
        }

    })

    socket.on("client-upload-image", async ({ _id, image, }) => {
        console.log("client-upload-image")
        try {
            let uploadedImage = await cloudinary.uploader.upload(image);
            
            // console.log("file loaded", filedLoaded.map(file => file.url))
            uploadedImage = uploadedImage.url

            const updatedImageUser = await User.findOneAndUpdate({ _id }, { image: uploadedImage, }, { new : true })
            if (updatedImageUser) {
                console.log("updatedImageUser", updatedImageUser)
                io.emit("server-send-upload-image", { user: updatedImageUser })
            }
            else throw new Error("Upload image failed")
        } catch (error) {
            console.log(error)
            io.emit("server-send-upload-image", { error })
        }

    })

    socket.on("client-change-profile-password", async ({ _id, password, newPassword }) => {
        // console.log("client-change-profile-password ",_id, password, newPassword)
        User.findById(_id).then(user => {
            if (!user) throw new Error("Người dùng không tồn tại");
            return bcrypt.compare(password, user.password)
        }).then(async (isValid, error) => {
            console.log(error, isValid)
            if (error) throw new Error(error.message);
            if (!isValid) throw new Error("Sai mật khẩu xác nhận");
            // if (newPassword === password) console.log("same ", newPassword === password)
            const salt = await bcrypt.genSalt(10)
            newPassword = await bcrypt.hash(newPassword, salt)
            return User.findOneAndUpdate({ _id }, { password: newPassword }, { new: true });
        }).then(updatedPasswordUser => {
            if (!updatedPasswordUser) throw new Error("Cập nhật mật khẩu thất bại")
            else {
                socket.emit("server-send-change-profile-password", { user: updatedPasswordUser })
            }
        }).catch(error => {
            console.log(error)
            socket.emit("server-send-change-profile-password", { error })
        })
    })
})


server.listen( port, () => {
    console.log(`server listening on port ${port}: http://localhost:${port}`);
})