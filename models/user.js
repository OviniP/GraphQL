const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const schema = new mongoose.Schema({
    username:{
        type:String,
        unique:true,
        required:true,
        minlLength:3
    },
    favoriteGenre: {
        type:String,
        required:true,
        minlLength:3
    }
})

schema.plugin(uniqueValidator)

module.exports = mongoose.model('User',schema)