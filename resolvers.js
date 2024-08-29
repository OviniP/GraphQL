const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')
const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()

const Book = require('./models/book')
const User = require('./models/user')
const Author = require('./models/author')

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
          pubsub.publish('BOOK_ADDED', { bookAdded: book })
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
    },
    Subscription: {
      bookAdded: {
        subscribe: () => pubsub.asyncIterator('BOOK_ADDED')
      },
    },
  }

module.exports = resolvers