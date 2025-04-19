       function getUnit(){
        fetch('https://mhbodhi.medtalent.co/api/reportanalytics/getUnitList',{
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({  }),
        })
        .then(response => response.json())
        .then(data => {
            console.log(data);
        })
        .catch(error => {
            console.error('Error fetching units:', error);
        });
       }

       getUnit();