const { program } = require('commander'); 
const superagent = require('superagent'); 
const fs = require('fs');
const path = require('path'); 
const http = require('http');
const express = require('express');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

program.requiredOption('-h, --host <ip>','ip-adresa').requiredOption('-p, --port <port>','port').requiredOption('-c, --cache <directions>','direction to file');

program.parse();

const options = program.opts();
const HOST = options.host, PORT = options.port, DIR = path.resolve(options.cache),FILE = path.join(DIR,'data.json'),PHOTOFILE=path.join(DIR,'uploads/');

let id = (() => {
    if (fs.existsSync(FILE)) {
        let idFile = fs.readFileSync(FILE, 'utf-8');
        let idParserFile = JSON.parse(idFile);
        if (idParserFile.length === 0) return 1;
        
        let maxId = idParserFile.reduce((max, item) => (item.id > max ? item.id : max), 0);
        return maxId + 1;
    }
    else
        return 1;
})();

try{
    fs.mkdirSync(String(options.cache),{ recursive: true });
    if(!fs.existsSync(FILE))
        fs.writeFileSync((FILE),JSON.stringify([ ], null, 2));
}catch(err){
    console.error(err.message); process.exit(1);}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

let upload = multer({dest: PHOTOFILE});

app.get('/', (req,res) => {
    res.send('<a href ="/RegisterForm.html">Go to Register</a> <a href ="/SearchForm.html">Go to Search</a>');
})

app.get('/inventory', (req,res) => {
    res.status(200).sendFile(FILE);
})

app.get('/inventory/:id', (req,res) => {
    let fileData = fs.readFileSync(FILE,'utf-8');
    let parseData = JSON.parse(fileData);
    let filterData = parseData.find((item) => item.id == req.params.id);
    if(filterData)
        res.status(200).send(filterData);
    else
        res.status(404).send("Item with this ID not found");
})

app.get('/inventory/:id/photo', (req,res) => {
    try{
    let fileData = fs.readFileSync(FILE,'utf-8');
    let parseData = JSON.parse(fileData);
    let filterData = parseData.find((item) => item.id == req.params.id);

    if(!filterData){
        res.status(404).send("Item with this ID not found"); return;}

    if (!filterData.photo){
        res.status(404).send("Photo not found for this item"); return;}
    
    res.setHeader('Content-Type', 'image/jpeg').sendFile(path.resolve(PHOTOFILE,filterData.fileName));
    }catch(err){
        console.error(err);
        res.status(500).send("Server error");
    }
})

app.get('/RegisterForm.html', (req,res) => {
    res.sendFile(path.resolve(__dirname,'RegisterForm.html'))
})

app.get('/SearchForm.html', (req,res) => {
    res.sendFile(path.resolve(__dirname,'SearchForm.html'))
})


app.post('/register',upload.single('photo'), (req,res) =>{

    try{

       let name = req.body.inventory_name;
       let description =  req.body.description;
       let photo = req.file;

       if(!name){
        return res.status(400).send({ error: 'Inventory name is required.' });
       }

       
       let newItem = {
        name: name,
        description: description ?? "",
        id: id,
        photo: req.file ? `/inventory/${id}/photo` : "" ,
        fileName: req.file ? photo.filename : ""
       };

        try{
            filedata = fs.readFileSync(FILE,'utf-8');
            data = JSON.parse(filedata);
            data.push(newItem);
            fs.writeFileSync(FILE,JSON.stringify(data,0,2));id++;
            
            res.status(201).send("Item created successfully")
        }catch(err){
            console.error(err);
            res.status(500).send("Server error");
        }

    }catch(err){
        console.error(err);
        res.status(500).send("Server error");
    }
})

app.post('/search', (req,res) =>{
    try{
    let fileData = fs.readFileSync(FILE,'utf-8');
    let parseData = JSON.parse(fileData);
    let filterData = parseData.find((item) => item.id == req.body.id);
    let hasphoto = req.body.includePhoto;
    
    if (!filterData) {
            return res.status(404).send("Item with this ID not found");
        }
    let responsData= filterData;

    if (!(hasphoto === "on")){
            responsData = {
            name: filterData.name,
            description: filterData.description ?? "",
            id: filterData.id,
        }
    }
       // 200 OK - Пошук виконано успішно
       res.status(200).send(responsData);
    
    }catch(err){
       res.status(500).send("Server error");
       console.error(err);
    }
})

app.put('/inventory/:id', (req,res) =>{
    let fileData = fs.readFileSync(FILE,'utf-8');
    let parseData = JSON.parse(fileData);
    let filterData = parseData.find((item) => item.id == req.params.id);

    if(!filterData){
        res.status(404).send("Item with this ID not found")
        return;}

    try{
    let changeName = req.body.name ?? filterData.name;
    let changeDescription = req.body.description ?? filterData.description;

    filterData.name = changeName;
    filterData.description = changeDescription;

    fs.writeFileSync(FILE,JSON.stringify(parseData, 0, 2))

    
    res.status(200).send(filterData)

    }catch(err){
        res.status(500).send("Server error")
        console.error(err);
    }

})

app.put('/inventory/:id/photo',upload.single('photo'), (req,res) =>{
    if(!req.file)
        return res.status(400).send("No file uploaded");

       try{ 
    let fileData = fs.readFileSync(FILE,'utf-8');
    let parseData = JSON.parse(fileData);
    let filterData = parseData.find((item) => item.id == req.params.id);

        if(!filterData) {
           fs.rmSync(req.file.path); 
           return res.status(404).send("Item with this ID not found");
        }

        let photoFile = req.file;
     
        let curentPhoto = filterData.fileName;
        filterData.fileName = photoFile.filename;
        if(!curentPhoto){
           filterData.photo = `/inventory/${req.params.id}/photo`;
        }
        else{
            if(fs.existsSync(path.join(PHOTOFILE,curentPhoto)))
            fs.rmSync(path.join(PHOTOFILE,curentPhoto));
        }
    fs.writeFileSync(FILE,JSON.stringify(parseData, 0, 2))

    res.status(200).send("Photo updated successfully")
    
    }catch(err){
        res.status(500).send("Server error")
        console.error(err)
    }

})

app.delete('/inventory/:id', (req,res) => {
    let fileData = fs.readFileSync(FILE,'utf-8');
    let parseData = JSON.parse(fileData);
    let filterData = parseData.filter((item) => !(item.id == req.params.id));
    
    if(filterData.length !== parseData.length){
        fs.writeFileSync(FILE,JSON.stringify(filterData,0,2));
        res.status(200).send(filterData);
    }
    else
        res.status(404).send("Item with this ID not found");
})

app.use((req, res) => {
    res.status(405).send("Method not allowed");
});

app.listen(PORT, () => console.log(`Сервер запущенно на http://${HOST}:${PORT}`))