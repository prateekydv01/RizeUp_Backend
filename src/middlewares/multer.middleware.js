import multer from "multer"
import path from 'path';

//store file in disk
const storage = multer.diskStorage({
    destination:function(req,file,cb){
        cb(null,'./public/temp')
    },
    filename: function(req,file,cb){
        const ext = path.extname(file.originalname);        // Get extension (.jpg, .mp4)
        const baseName = path.basename(file.originalname, ext); // Get filename without extension
        
        const newFileName = `${baseName}-${Date.now()}${ext}`;  // e.g. myvideo-17182030001.mp4
        cb(null, newFileName);
    }
})

export const upload = multer({
    storage
})