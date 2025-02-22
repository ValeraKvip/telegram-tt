export function canCollapseQuote(text:string):boolean{   
    if(!text || ! text.length){
        return false;
    }    
    return text.length > 200 || text.split('<br>').length > 3 || text.split('\n').length > 3 || text.split('</div>').length >= 3
};
