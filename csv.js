const {createObjectCsvWriter} = require('csv-writer')

const data = [
    {id: 1, name: "John", score: 90},
    {id: 2, name: "Paul", score: 80},
    {id: 3, name: "Ringo", score: 91},
    {id: 4, name: "George", score: 100}
    ]

    const csvWriter = createObjectCsvWriter({
    path: ".result.csv",
    header: [
        {id: 'id', title: 'No.'},
        {id: 'name', title: '氏名'},
        {id: 'score', title: '点数'}
    ],
    encoding:'utf8',
    append :false,
    });
    csvWriter.writeRecords(data)
    .then(() => {
        console.log('Done');
})
