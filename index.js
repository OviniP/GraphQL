const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { v1: uuid } = require('uuid')
const mongoose = require('mongoose')
mongoose.set('strictQuery', false)
const Author = require('./models/author')
const User = require('./models/user');
const Book = require('./models/book')
const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to Mongo db')
  })
  .catch(error => {
    console.log('error connecting to mongo db,', error.message)
  })


const typeDefs = `
  type Book {
    title: String!
    published: Int!
    author: Author!
    id: ID!
    genres: [String!]
  }
    
  type Author {
    name: String!
    id: ID!
    born: Int,
    bookCount:Int
  }
  
  type User {
    username: String!
    favoriteGenre: String!
    id:ID!
  }

  type Token {
    value: String!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks (author: String, genre: String): [Book!]
    allAuthors: [Author!]!
    me: User
  }

  type Mutation {
    addBook(
        title: String!
        published: Int!
        author: String!
        genres: [String!]
    ): Book

    editAuthor(
        name: String!
        setBornTo: Int!
    ):Author

    createUser(
        username: String!
        favoriteGenre: String!
    ): User

    login(
      username: String!
      password: String!
    ):Token
  }
`

const resolvers = {
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
        console.log(args)
        if(args.author !== undefined){
            const author =  await Author.findOne({name:args.author})
            return  Book.find({author:author.id})
        }
        else if(args.genre !== undefined ){
            return  Book.find({genres:args.genre})
        }
        else return (Book.find({}).populate('author'))
    },
    allAuthors: async () => Author.find({}),
    me:(root, args, context) => {
      return context.currentUser
    }
  },
  Author: {
    bookCount: async (root) => {
        return Book.where({author: root.id}).countDocuments()
    }
  }, 
  Mutation: {
    addBook: async (root, args) => {
        
        let author = await Author.findOne({ name: args.author })
        if(!author){
            author = new Author({"name" :args.author})
            try{
              await author.save()
            }
            catch(error){
              throw new GraphQLError('Saving author failed',{
                extensions:{
                  code:'BAD_USER_INPUT',
                  invalidArgs: args.name,
                  error
                }
              })
            }
        }

        const book = new Book({...args, author:author})
        try{
          await book.save()
        }
        catch(error){
          throw new GraphQLError('Saving Book failed' , {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.name,
              error
            }
          })
        }
        return book
    },
    editAuthor: async (root, args) => {
        const author = await Author.findOne({name : args.name})
        if(author){
            author.born = args.setBornTo
            return author.save()
        }
        else
             return null
    },
    createUser: async(root, args) => {
      const user = new User({username:args.username, favoriteGenre:args.favoriteGenre})
      return user.save()
        .catch(error => {
          throw new GraphQLError('User creation failed',{
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.username,
              error
            }
          })
        })
    },

    login: async(root, args) => {
      const user = await User.findOne({username:args.username})

      if(!user && args.password != 'secret'){
        throw new GraphQLError('Invalid login',{
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        })
      }

     const userForToken = {
      username:user.username,
      id:user._id
     }

     return {value: jwt.sign(userForToken, process.env.JWT_SECRET)}
    }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req, res }) => {
    const auth = req ? req.headers.authorization : null
    if(auth && auth.startsWith('bearer')){
      const decodedToken = jwt.verify(auth.substring(7),process.env.JWT_SECRET)
      const currentUser = await User.findById(decodedToken.id)
      return {currentUser}
    }
  }
}).then(({ url }) => {
  console.log(`Server ready at ${url}`)
})