import mongoose,{Schema} from "mongoose";

const GoalsSchema = new Schema({
    title:{
        type:String,
        required:true
    },
    expectedCompletionDate:{
        type:Date,
        required:true
    },
    resourcesURL:[{
        type:String,
        required:true
    }],
    Stages:[
        {
            type: Schema.Types.ObjectId,
            ref:"Stage"
        }
    ],
    type:{
        type:String,
        enum:["personal","circle"],
        default:"personal"
    },
    status:{
        type:String,
        enum:["active","completed","backlog"],
        default:"active"
    },
    createdBy:{
        type:Schema.Types.ObjectId,
        required:true
    },
    circleId: {
      type: Schema.Types.ObjectId,
      ref: "Circle",
    }
    
},{ timestamps: true })

export const Goals = mongoose.model("Goals",GoalsSchema)